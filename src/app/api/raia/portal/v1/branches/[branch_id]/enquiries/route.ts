// GET /api/raia/portal/v1/branches/{branch_id}/enquiries
//
// Cursor-based polling. The cursor is `cursor_seq` (BIGSERIAL) from the
// tbl_portal_enquiries row. Callers pass since_enquiry_id from the previous
// response's next_cursor, OR a `since` ISO datetime alternative. The server
// returns up to `limit` rows in ascending cursor order and surfaces the
// largest cursor as `next_cursor`.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, withRateLimitHeaders } from '@/lib/portal/auth';
import { badRequest, serverError } from '@/lib/portal/problem';
import { portalTable, type PortalEnquiryRow } from '@/lib/portal/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branch_id: string }> }
): Promise<NextResponse> {
  const { branch_id } = await params;
  const instance = `/api/raia/portal/v1/branches/${branch_id}/enquiries`;

  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'branches.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const url = new URL(request.url);
  const since_enquiry_id = url.searchParams.get('since_enquiry_id');
  const since = url.searchParams.get('since');
  const limit = Math.min(
    500,
    Math.max(1, parseInt(url.searchParams.get('limit') || '100', 10))
  );

  let cursorMin: number | null = null;
  if (since_enquiry_id) {
    const { data: cursorRow } = await portalTable('tbl_portal_enquiries')
      .select('cursor_seq')
      .eq('enquiry_id', since_enquiry_id)
      .maybeSingle();
    const seq = (cursorRow as unknown as { cursor_seq: number } | null)?.cursor_seq;
    if (typeof seq !== 'number') {
      return badRequest(
        'Unknown since_enquiry_id.',
        [{ field: 'since_enquiry_id', message: 'cursor not found', code: 'INVALID' }],
        instance
      );
    }
    cursorMin = seq;
  }

  let q = portalTable('tbl_portal_enquiries')
    .select('*')
    .eq('branch_id', branch_id)
    .eq('agent_id', ctx.agent_id)
    .order('cursor_seq', { ascending: true })
    .limit(limit);
  if (cursorMin !== null) q = q.gt('cursor_seq', cursorMin);
  if (since) {
    if (Number.isNaN(Date.parse(since))) {
      return badRequest('since must be ISO 8601 datetime.', undefined, instance);
    }
    q = q.gte('received_at', since);
  }

  const { data, error } = await q;
  if (error) {
    console.error('[portal/enquiries] query', error.message);
    return serverError('Query failed.', instance);
  }
  const rows = (data as unknown as PortalEnquiryRow[]) || [];
  const next_cursor = rows.length > 0 ? rows[rows.length - 1].enquiry_id : since_enquiry_id || null;

  return withRateLimitHeaders(
    NextResponse.json(
      {
        enquiries: rows.map((r) => ({
          enquiry_id: r.enquiry_id,
          listing_reference: r.listing_reference,
          received_at: r.received_at,
          source: r.source,
          ...(typeof r.payload === 'object' && r.payload !== null ? r.payload : {})
        })),
        next_cursor
      },
      { status: 200 }
    ),
    ctx
  );
}
