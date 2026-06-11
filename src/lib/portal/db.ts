// Typed Supabase admin client for portal-feed tables.
//
// The shared database.types.ts is regenerated from the live schema and does
// not yet include the 0006 portal-feed tables. We declare local row/insert
// types here and cast the admin client. When `supabase gen types` is rerun,
// these can be folded into Database directly.

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { Json } from '@/lib/database.types';

export interface PortalCredentialRow {
  client_id: string;
  secret_hash: string;
  label: string | null;
  allowed_scopes: string[];
  agent_id: string;
  default_branch_id: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  rate_limit_per_min: number;
  created_at: string;
  updated_at: string;
}

export interface PortalListingRow {
  listing_pk: string;
  reference: string;
  branch_id: string;
  agent_id: string;
  client_id: string | null;
  kind: 'residential' | 'commercial';
  transaction_type: 'SALES' | 'LETTINGS';
  status: string | null;
  payload: Json;
  payload_hash: string;
  public_card_raia_id: string | null;
  public_card_url: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  removal_reason: string | null;
  removal_note: string | null;
}

export interface PortalEnquiryRow {
  enquiry_id: string;
  cursor_seq: number;
  branch_id: string;
  agent_id: string;
  listing_reference: string | null;
  received_at: string;
  source: string | null;
  payload: Json;
}

export interface PortalActivationRow {
  id: string;
  product: 'PREMIUM_LISTING' | 'FEATURED_PROPERTY';
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REJECTED' | 'CANCELLED';
  client_id: string;
  branch_id: string | null;
  customer_listing_id: string | null;
  listing_id: string | null;
  request: Json;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
}

export interface PortalPerformanceRow {
  branch_id: string;
  portal: string;
  metric_date: string;
  impressions: number;
  detail_views: number;
  click_throughs: number;
  phone_reveals: number;
  brochure_downloads: number;
  enquiries: number;
}

export type PortalTable =
  | 'tbl_portal_credentials'
  | 'tbl_portal_branches'
  | 'tbl_portal_listings'
  | 'tbl_portal_enquiries'
  | 'tbl_portal_performance'
  | 'tbl_portal_product_activations'
  | 'tbl_portal_rate_limits'
  | 'tbl_portal_audit_log';

// Returns an untyped query builder for portal-feed tables. The Database type
// in src/lib/database.types.ts is regenerated from Supabase and lags this
// migration; rather than fight the strict generic, we erase types here and
// cast results at the call site to the explicit row interfaces above.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional
// type erasure; row shapes are restored at the call site.
// prettier-ignore
type AnyBuilder = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export function portalTable(name: PortalTable): AnyBuilder {
  const admin = createSupabaseAdminClient() as unknown as {
    from: (n: string) => AnyBuilder;
  };
  return admin.from(name);
}

export async function audit(
  action: string,
  args: {
    client_id?: string | null;
    target?: string | null;
    trace_id?: string | null;
    ip?: string | null;
    detail?: Record<string, unknown> | null;
  } = {}
): Promise<void> {
  try {
    const t = portalTable('tbl_portal_audit_log');
    await t.insert({
      action,
      client_id: args.client_id ?? null,
      target: args.target ?? null,
      trace_id: args.trace_id ?? null,
      ip: args.ip ?? null,
      detail: args.detail ?? null
    });
  } catch (e) {
    console.error('[portal/audit] insert failed', e);
  }
}
