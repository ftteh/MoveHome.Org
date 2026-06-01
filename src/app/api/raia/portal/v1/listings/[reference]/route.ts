// PUT/GET/DELETE /api/raia/portal/v1/listings/{reference}
//
// Core ingestion surface for the RAIA Portal Feed API. PUT upserts; idempotent
// re-PUT of an identical payload returns 200 with action: NO_CHANGE. DELETE
// soft-removes (sets removed_at + removal_reason) and withdraws the public
// card if one was derived. GET reads a listing back; an optional
// X-RAIA-Branch-Id header narrows by branch.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, withRateLimitHeaders } from '@/lib/portal/auth';
import {
  badRequest,
  conflict,
  notFound,
  serverError,
  unauthorized
} from '@/lib/portal/problem';
import {
  audit,
  portalTable,
  type PortalListingRow
} from '@/lib/portal/db';
import {
  DeleteListingBody,
  ReferencePattern,
  parseListingPayload,
  zodIssuesToValidationErrors
} from '@/lib/portal/validation';
import { sha256Canonical } from '@/lib/portal/canonical';
import { upsertPublicCard, withdrawPublicCard } from '@/lib/portal/public-card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 1_048_576; // 1 MB hard cap on PUT/DELETE bodies.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://movehome.org';

function buildInstance(reference: string): string {
  return `/api/raia/portal/v1/listings/${reference}`;
}

function validReference(ref: string): boolean {
  return ReferencePattern.test(ref);
}

async function readBody(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const lenHeader = request.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_BODY_BYTES) {
    return { ok: false, reason: 'Request body exceeds 1 MB cap.' };
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, reason: 'Could not read request body.' };
  }
  if (text.length > MAX_BODY_BYTES) {
    return { ok: false, reason: 'Request body exceeds 1 MB cap.' };
  }
  if (!text.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: 'Body is not valid JSON.' };
  }
}

// ── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<NextResponse> {
  const { reference } = await params;
  const instance = buildInstance(reference);

  if (!validReference(reference)) {
    return badRequest(
      'Reference must match ^[A-Za-z0-9_-]{1,100}$.',
      [{ field: 'reference', message: 'invalid format', code: 'INVALID' }],
      instance
    );
  }

  const auth = await requireAuth(request, {
    scope: 'feed.write',
    group: 'listings.write',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const body = await readBody(request);
  if (!body.ok) return badRequest(body.reason, undefined, instance);

  const parsed = parseListingPayload(body.value);
  if (!parsed.ok) {
    return badRequest('Listing payload failed validation.', parsed.errors, instance);
  }
  const payload = parsed.data;

  // Commercial: building.reference must equal path reference.
  if (payload.kind === 'commercial' && payload.building.reference !== reference) {
    return badRequest(
      'building.reference must equal path {reference}.',
      [
        {
          field: 'building.reference',
          message: `Expected "${reference}".`,
          code: 'MISMATCH'
        }
      ],
      instance
    );
  }

  // Resolve branch_id. Order: explicit X-RAIA-Branch-Id header → token's
  // branch_id claim → credential default_branch_id → fallback to client_id
  // (single-branch integrators get a stable virtual branch).
  const headerBranch = request.headers.get('x-raia-branch-id') || '';
  const branch_id = String(headerBranch || ctx.branch_id_hint || ctx.client_id);
  if (!branch_id) {
    return badRequest(
      'No branch could be resolved. Provide X-RAIA-Branch-Id header or set default_branch_id on the credential.',
      undefined,
      instance
    );
  }

  const payload_hash = sha256Canonical(payload);

  // Look up any existing row keyed by (branch_id, reference).
  const { data: existingData, error: lookupErr } = await portalTable('tbl_portal_listings')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('reference', reference)
    .maybeSingle();
  if (lookupErr) {
    console.error('[portal/PUT] lookup', lookupErr.message);
    return serverError('Listing lookup failed.', instance);
  }
  const existing = existingData as unknown as PortalListingRow | null;

  // Cross-branch reference clash: if a different branch under the same agent
  // already owns this reference and the caller is not its owner, return 409.
  if (!existing) {
    const { data: otherData } = await portalTable('tbl_portal_listings')
      .select('branch_id, agent_id')
      .eq('reference', reference)
      .eq('agent_id', ctx.agent_id);
    if (otherData && (otherData as unknown as { branch_id: string }[]).some(
      (r) => r.branch_id !== branch_id
    )) {
      return conflict(
        `Reference "${reference}" already exists under a different branch for this agent.`,
        instance
      );
    }
  }

  const now = new Date().toISOString();

  // ── NO_CHANGE path ────────────────────────────────────────────────────────
  if (existing && !existing.removed_at && existing.payload_hash === payload_hash) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          reference,
          action: 'NO_CHANGE',
          updated_at: existing.updated_at,
          version: existing.version,
          public_card_url: existing.public_card_url
        },
        { status: 200 }
      ),
      ctx
    );
  }

  // ── Public card derivation ───────────────────────────────────────────────
  const card = await upsertPublicCard({
    agent_id: ctx.agent_id,
    reference,
    payload,
    existingRaiaId: existing?.public_card_raia_id || null
  });

  // ── Upsert ────────────────────────────────────────────────────────────────
  const isCreate = !existing;
  const newVersion = existing ? existing.version + 1 : 1;

  if (isCreate) {
    const { error: insertErr } = await portalTable('tbl_portal_listings').insert({
      reference,
      branch_id,
      agent_id: ctx.agent_id,
      client_id: ctx.client_id,
      kind: payload.kind,
      transaction_type: payload.transaction_type,
      status:
        payload.kind === 'residential' ? payload.status : payload.building.status,
      payload: payload as unknown as object,
      payload_hash,
      public_card_raia_id: card?.raia_id ?? null,
      public_card_url: card?.public_card_url ?? null,
      version: 1,
      created_at: now,
      updated_at: now
    });
    if (insertErr) {
      console.error('[portal/PUT] insert', insertErr.message);
      return serverError('Could not create listing.', instance);
    }
  } else {
    const { error: updateErr } = await portalTable('tbl_portal_listings')
      .update({
        kind: payload.kind,
        transaction_type: payload.transaction_type,
        status:
          payload.kind === 'residential'
            ? payload.status
            : payload.building.status,
        payload: payload as unknown as object,
        payload_hash,
        public_card_raia_id: card?.raia_id ?? null,
        public_card_url: card?.public_card_url ?? null,
        version: newVersion,
        updated_at: now,
        removed_at: null,
        removal_reason: null,
        removal_note: null,
        client_id: ctx.client_id
      })
      .eq('branch_id', branch_id)
      .eq('reference', reference);
    if (updateErr) {
      console.error('[portal/PUT] update', updateErr.message);
      return serverError('Could not update listing.', instance);
    }
  }

  await audit(isCreate ? 'portal.listing.created' : 'portal.listing.updated', {
    client_id: ctx.client_id,
    target: `${branch_id}/${reference}`,
    detail: { hash: payload_hash, version: newVersion }
  });

  return withRateLimitHeaders(
    NextResponse.json(
      {
        reference,
        action: isCreate ? 'CREATED' : 'UPDATED',
        updated_at: now,
        version: newVersion,
        public_card_url: card?.public_card_url ?? null
      },
      { status: isCreate ? 201 : 200 }
    ),
    ctx
  );
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<NextResponse> {
  const { reference } = await params;
  const instance = buildInstance(reference);

  if (!validReference(reference)) {
    return badRequest('Reference invalid.', undefined, instance);
  }

  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'listings.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const headerBranch = request.headers.get('x-raia-branch-id') || '';

  let query = portalTable('tbl_portal_listings')
    .select('*')
    .eq('reference', reference)
    .eq('agent_id', ctx.agent_id);
  if (headerBranch) query = query.eq('branch_id', headerBranch);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error('[portal/GET listing] lookup', error.message);
    return serverError('Lookup failed.', instance);
  }
  const row = data as unknown as PortalListingRow | null;
  if (!row) return notFound('Listing not found.', instance);
  if (row.removed_at) return notFound('Listing has been removed.', instance);

  return withRateLimitHeaders(
    NextResponse.json(buildListingResponse(row), { status: 200 }),
    ctx
  );
}

function buildListingResponse(row: PortalListingRow) {
  const payload = row.payload as Record<string, unknown>;
  const base = {
    reference: row.reference,
    branch_id: row.branch_id,
    transaction_type: row.transaction_type,
    status: row.status,
    kind: row.kind,
    public_card_url: row.public_card_url ?? `${SITE_URL}/property/${row.public_card_raia_id ?? ''}`,
    created_at: row.created_at,
    updated_at: row.updated_at,
    version: row.version
  };
  if (row.kind === 'residential') {
    return { ...base, residential: stripDiscriminator(payload) };
  }
  return { ...base, commercial: stripDiscriminator(payload) };
}

function stripDiscriminator(p: Record<string, unknown>): Record<string, unknown> {
  const { kind: _kind, ...rest } = p;
  void _kind;
  return rest;
}

// ── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<NextResponse> {
  const { reference } = await params;
  const instance = buildInstance(reference);

  if (!validReference(reference)) {
    return badRequest('Reference invalid.', undefined, instance);
  }

  const auth = await requireAuth(request, {
    scope: 'feed.write',
    group: 'listings.write',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const body = await readBody(request);
  if (!body.ok) return badRequest(body.reason, undefined, instance);
  if (!body.value || typeof body.value !== 'object') {
    return badRequest('DELETE body required with removal_reason.', undefined, instance);
  }
  const parsed = DeleteListingBody.safeParse(body.value);
  if (!parsed.success) {
    return badRequest(
      'DELETE body validation failed.',
      zodIssuesToValidationErrors(parsed.error.issues),
      instance
    );
  }
  const { removal_reason, branch_id: bodyBranch, removed_at, note } = parsed.data;

  const branch_id = String(bodyBranch ?? ctx.branch_id_hint ?? ctx.client_id);

  const { data: existingData, error: lookupErr } = await portalTable('tbl_portal_listings')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('reference', reference)
    .maybeSingle();
  if (lookupErr) {
    console.error('[portal/DELETE] lookup', lookupErr.message);
    return serverError('Lookup failed.', instance);
  }
  const existing = existingData as unknown as PortalListingRow | null;

  if (!existing) {
    return notFound('Listing not found for this branch.', instance);
  }

  if (existing.agent_id !== ctx.agent_id) {
    return unauthorized('Credential is not authorised for this listing.', instance);
  }

  const stamp = removed_at || new Date().toISOString();

  // Idempotent: already-removed → return 200 with the recorded state.
  if (existing.removed_at) {
    return withRateLimitHeaders(
      NextResponse.json(
        {
          reference,
          removed_at: existing.removed_at,
          removal_reason: existing.removal_reason ?? removal_reason
        },
        { status: 200 }
      ),
      ctx
    );
  }

  const { error: updateErr } = await portalTable('tbl_portal_listings')
    .update({
      removed_at: stamp,
      removal_reason,
      removal_note: note ?? null,
      version: existing.version + 1,
      updated_at: stamp
    })
    .eq('branch_id', branch_id)
    .eq('reference', reference);
  if (updateErr) {
    console.error('[portal/DELETE] update', updateErr.message);
    return serverError('Could not delete listing.', instance);
  }

  if (existing.public_card_raia_id) {
    await withdrawPublicCard(ctx.agent_id, existing.public_card_raia_id);
  }

  await audit('portal.listing.deleted', {
    client_id: ctx.client_id,
    target: `${branch_id}/${reference}`,
    detail: { removal_reason, note: note ?? null }
  });

  return withRateLimitHeaders(
    NextResponse.json({ reference, removed_at: stamp, removal_reason }, { status: 200 }),
    ctx
  );
}
