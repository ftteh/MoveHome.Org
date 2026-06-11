// GET /api/raia/portal/v1/branches/{branch_id}/listings
//
// Paginated reconciliation snapshot. Callers diff this against their CRM to
// find drift between their canonical inventory and what MoveHome has.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, withRateLimitHeaders } from '@/lib/portal/auth';
import { badRequest, serverError } from '@/lib/portal/problem';
import { portalTable, type PortalListingRow } from '@/lib/portal/db';
import { StatusEnum, TransactionTypeEnum } from '@/lib/portal/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branch_id: string }> }
): Promise<NextResponse> {
  const { branch_id } = await params;
  const instance = `/api/raia/portal/v1/branches/${branch_id}/listings`;

  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'branches.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const url = new URL(request.url);
  const transaction_type = url.searchParams.get('transaction_type');
  const status = url.searchParams.get('status');
  const updated_since = url.searchParams.get('updated_since');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const per_page = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get('per_page') || '50', 10))
  );

  if (transaction_type && !TransactionTypeEnum.safeParse(transaction_type).success) {
    return badRequest('transaction_type must be SALES or LETTINGS.', undefined, instance);
  }
  if (status && !StatusEnum.safeParse(status).success) {
    return badRequest('status not in enum.', undefined, instance);
  }
  if (updated_since && Number.isNaN(Date.parse(updated_since))) {
    return badRequest('updated_since must be ISO 8601.', undefined, instance);
  }

  // Authorization: the credential must own this branch (same agent_id).
  let q = portalTable('tbl_portal_listings')
    .select('*', { count: 'exact' })
    .eq('branch_id', branch_id)
    .eq('agent_id', ctx.agent_id)
    .is('removed_at', null);
  if (transaction_type) q = q.eq('transaction_type', transaction_type);
  if (status) q = q.eq('status', status);
  if (updated_since) q = q.gte('updated_at', updated_since);
  q = q
    .order('updated_at', { ascending: false })
    .range((page - 1) * per_page, page * per_page - 1);

  const { data, error, count } = (await q) as {
    data: PortalListingRow[] | null;
    error: { message: string } | null;
    count: number | null;
  };
  if (error) {
    console.error('[portal/branch listings] query', error.message);
    return serverError('Query failed.', instance);
  }
  const rows = data || [];

  return withRateLimitHeaders(
    NextResponse.json(
      {
        meta: { page, per_page, total: count ?? rows.length },
        listings: rows.map((row) => ({
          reference: row.reference,
          transaction_type: row.transaction_type,
          status: row.status,
          kind: row.kind,
          public_card_url: row.public_card_url,
          updated_at: row.updated_at,
          version: row.version
        }))
      },
      { status: 200 }
    ),
    ctx
  );
}
