// POST /oauth/token — RAIA Portal Feed API OAuth2 client_credentials grant.
//
// The caller authenticates via HTTP Basic with their client_id / client_secret
// and requests one or more scopes from {feed.read, feed.write, products.write}.
// We verify the credential row, intersect requested scopes with the
// credential's allowed_scopes, mint an HS256 JWT (1 h TTL), and audit-log the
// issuance.

import { NextResponse, type NextRequest } from 'next/server';
import { issuePortalAccessToken } from '@/lib/portal/jwt';
import { verifyClientSecret, safeEqualString } from '@/lib/portal/secrets';
import {
  badRequest,
  unauthorized,
  serverError,
  tooManyRequests
} from '@/lib/portal/problem';
import { audit, portalTable, type PortalCredentialRow } from '@/lib/portal/db';
import { enforceRateLimit } from '@/lib/portal/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SCOPES = ['feed.read', 'feed.write', 'products.write'] as const;
type Scope = (typeof ALLOWED_SCOPES)[number];
const TOKEN_TTL_SECONDS = 3600;

function decodeBasic(header: string | null): { id: string; secret: string } | null {
  if (!header) return null;
  const lower = header.toLowerCase();
  if (!lower.startsWith('basic ')) return null;
  const b64 = header.slice(6).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return null;
  return { id: decoded.slice(0, idx), secret: decoded.slice(idx + 1) };
}

function clientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

export async function POST(request: NextRequest) {
  const instance = '/oauth/token';

  // ── Parse Basic auth ─────────────────────────────────────────────────────
  const basic = decodeBasic(request.headers.get('authorization'));
  const formCreds = await tryParseFormCreds(request);
  const id = basic?.id || formCreds.id;
  const secret = basic?.secret || formCreds.secret;
  const grantType = formCreds.grantType;
  const requestedScope = formCreds.scope;

  if (!id || !secret) {
    return unauthorized(
      'Missing client_id / client_secret. Use HTTP Basic or form fields.',
      instance
    );
  }
  if (grantType !== 'client_credentials') {
    return badRequest(
      'Only grant_type=client_credentials is supported.',
      [{ field: 'grant_type', message: 'must be client_credentials', code: 'INVALID' }],
      instance
    );
  }

  // ── Rate limit token endpoint per client_id ──────────────────────────────
  const rl = await enforceRateLimit(id, 'token');
  if (!rl.ok) {
    return tooManyRequests(rl.retryAfter, rl.limit, rl.resetUnix, instance);
  }

  // ── Lookup credential ────────────────────────────────────────────────────
  let cred: PortalCredentialRow | null = null;
  try {
    const { data } = await portalTable('tbl_portal_credentials')
      .select('*')
      .eq('client_id', id)
      .maybeSingle();
    cred = data as unknown as PortalCredentialRow | null;
  } catch (e) {
    console.error('[/oauth/token] lookup', e);
    return serverError('Credential lookup failed.', instance);
  }

  // Constant-ish-time path even on miss: still hash the provided secret.
  const verified = cred && !cred.revoked_at
    ? verifyClientSecret(secret, cred.secret_hash)
    : false;

  if (!cred || cred.revoked_at || !verified) {
    // Always log unauthenticated token attempts (no client linkage).
    await audit('portal.token.failed', {
      client_id: cred?.client_id ?? id,
      ip: clientIp(request),
      detail: { reason: !cred ? 'unknown_client' : cred.revoked_at ? 'revoked' : 'bad_secret' }
    });
    return unauthorized('Invalid client_id or client_secret.', instance);
  }

  // Defense-in-depth: ensure id we just hashed against equals the row's id.
  if (!safeEqualString(cred.client_id, id)) {
    return unauthorized('Invalid client_id or client_secret.', instance);
  }

  // ── Resolve scopes ───────────────────────────────────────────────────────
  const requestedList = (requestedScope || cred.allowed_scopes.join(' '))
    .split(/\s+/)
    .filter(Boolean) as string[];

  const granted: Scope[] = [];
  const rejected: string[] = [];
  for (const s of requestedList) {
    if ((ALLOWED_SCOPES as readonly string[]).includes(s) && cred.allowed_scopes.includes(s)) {
      if (!granted.includes(s as Scope)) granted.push(s as Scope);
    } else {
      rejected.push(s);
    }
  }
  if (granted.length === 0) {
    return badRequest(
      'No requested scopes are permitted for this credential.',
      rejected.map((s) => ({ field: 'scope', message: `Scope "${s}" not granted`, code: 'SCOPE_DENIED' })),
      instance
    );
  }

  // ── Issue token ──────────────────────────────────────────────────────────
  let token, expiresAt, jti;
  try {
    ({ token, expiresAt, jti } = issuePortalAccessToken({
      sub: cred.client_id,
      scope: granted.join(' '),
      agent_id: cred.agent_id,
      branch_id: cred.default_branch_id ?? undefined,
      expiresInSeconds: TOKEN_TTL_SECONDS
    }));
  } catch (e) {
    console.error('[/oauth/token] sign', e);
    return serverError(
      'Token signing failed. Check RAIA_PORTAL_JWT_SECRET configuration.',
      instance
    );
  }

  await audit('portal.token.issued', {
    client_id: cred.client_id,
    ip: clientIp(request),
    detail: { jti, scope: granted.join(' '), exp: expiresAt }
  });

  return NextResponse.json(
    {
      access_token: token,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      scope: granted.join(' ')
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache'
      }
    }
  );
}

async function tryParseFormCreds(request: NextRequest): Promise<{
  id?: string;
  secret?: string;
  grantType?: string;
  scope?: string;
}> {
  const ct = (request.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('application/x-www-form-urlencoded')) return {};
  try {
    const text = await request.text();
    const params = new URLSearchParams(text);
    return {
      id: params.get('client_id') || undefined,
      secret: params.get('client_secret') || undefined,
      grantType: params.get('grant_type') || undefined,
      scope: params.get('scope') || undefined
    };
  } catch {
    return {};
  }
}
