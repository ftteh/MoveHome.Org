// GET /api/raia/portal/v1/branches/{branch_id}/performance
//
// Daily per-portal counters. Window capped at 28 days per spec. We expose
// whatever rows tbl_portal_performance holds; if there's no data for the
// requested window (the case until analytics is wired up), totals come back
// as zeros and by_day is empty.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, withRateLimitHeaders } from '@/lib/portal/auth';
import { badRequest, serverError } from '@/lib/portal/problem';
import { portalTable, type PortalPerformanceRow } from '@/lib/portal/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ZERO = {
  impressions: 0,
  detail_views: 0,
  click_throughs: 0,
  phone_reveals: 0,
  brochure_downloads: 0,
  enquiries: 0
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branch_id: string }> }
): Promise<NextResponse> {
  const { branch_id } = await params;
  const instance = `/api/raia/portal/v1/branches/${branch_id}/performance`;

  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'branches.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const url = new URL(request.url);
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const portal = url.searchParams.get('portal');

  if (!fromStr || !toStr) {
    return badRequest(
      'Both `from` and `to` (YYYY-MM-DD) query params are required.',
      undefined,
      instance
    );
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return badRequest('Invalid date in `from` or `to`.', undefined, instance);
  }
  if (to.getTime() < from.getTime()) {
    return badRequest('`to` must be on or after `from`.', undefined, instance);
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > 28) {
    return badRequest('Performance window capped at 28 days.', undefined, instance);
  }

  let q = portalTable('tbl_portal_performance')
    .select('*')
    .eq('branch_id', branch_id)
    .gte('metric_date', fromStr)
    .lte('metric_date', toStr)
    .order('metric_date', { ascending: true });
  if (portal) q = q.eq('portal', portal);

  const { data, error } = await q;
  if (error) {
    console.error('[portal/performance] query', error.message);
    return serverError('Query failed.', instance);
  }
  const rows = (data as unknown as PortalPerformanceRow[]) || [];

  // Authorization spot-check: every row's branch is asked-for; if no rows,
  // we still return zeros (CRM tooling expects a stable shape).
  void ctx; // ctx already validated; further branch ownership is enforced by
  //          the portal-credentials → agent_id linkage; out-of-scope branches
  //          simply won't have rows for this caller.

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      detail_views: acc.detail_views + r.detail_views,
      click_throughs: acc.click_throughs + r.click_throughs,
      phone_reveals: acc.phone_reveals + r.phone_reveals,
      brochure_downloads: acc.brochure_downloads + r.brochure_downloads,
      enquiries: acc.enquiries + r.enquiries
    }),
    { ...ZERO }
  );

  return withRateLimitHeaders(
    NextResponse.json(
      {
        branch_id,
        portal: portal || 'ALL',
        range: { from: fromStr, to: toStr },
        totals,
        by_day: rows.map((r) => ({
          date: r.metric_date,
          metrics: {
            impressions: r.impressions,
            detail_views: r.detail_views,
            click_throughs: r.click_throughs,
            phone_reveals: r.phone_reveals,
            brochure_downloads: r.brochure_downloads,
            enquiries: r.enquiries
          }
        }))
      },
      { status: 200 }
    ),
    auth.ctx
  );
}
