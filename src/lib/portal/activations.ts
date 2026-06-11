// Shared logic for the /products/{premium-listings,featured-properties}
// endpoints. Both products share the same lifecycle (PENDING → ACTIVE/EXPIRED
// /REJECTED/CANCELLED) and storage shape; only the validation schema differs.

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, withRateLimitHeaders, type Scope } from '@/lib/portal/auth';
import {
  badRequest,
  notFound,
  serverError
} from '@/lib/portal/problem';
import {
  audit,
  portalTable,
  type PortalActivationRow
} from '@/lib/portal/db';
import {
  FeaturedActivationRequest,
  PremiumActivationRequest,
  zodIssuesToValidationErrors
} from '@/lib/portal/validation';

export type Product = 'PREMIUM_LISTING' | 'FEATURED_PROPERTY';

interface ProductCfg {
  product: Product;
  basePath: string;
  schema: typeof PremiumActivationRequest | typeof FeaturedActivationRequest;
  responseField: 'premium' | 'featured';
}

const PREMIUM_CFG: ProductCfg = {
  product: 'PREMIUM_LISTING',
  basePath: '/api/raia/portal/v1/products/premium-listings',
  schema: PremiumActivationRequest,
  responseField: 'premium'
};

const FEATURED_CFG: ProductCfg = {
  product: 'FEATURED_PROPERTY',
  basePath: '/api/raia/portal/v1/products/featured-properties',
  schema: FeaturedActivationRequest,
  responseField: 'featured'
};

export const Cfg = { premium: PREMIUM_CFG, featured: FEATURED_CFG };

function shape(row: PortalActivationRow, kind: Product) {
  const req = (row.request || {}) as Record<string, unknown>;
  const base = {
    id: row.id,
    product: kind,
    status: row.status,
    customer_listing_id: row.customer_listing_id,
    listing_id: row.listing_id,
    branch_id: row.branch_id,
    created_at: row.created_at,
    starts_at: row.starts_at,
    ends_at: row.ends_at
  };
  if (kind === 'PREMIUM_LISTING') {
    return { ...base, highlights: req.highlights ?? null };
  }
  return base;
}

export async function listActivations(request: NextRequest, cfg: ProductCfg) {
  const instance = cfg.basePath;
  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'products.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const branch_id = url.searchParams.get('branch_id');
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  let q = portalTable('tbl_portal_product_activations')
    .select('*')
    .eq('client_id', ctx.client_id)
    .eq('product', cfg.product)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (status) q = q.eq('status', status);
  if (branch_id) q = q.eq('branch_id', branch_id);

  const { data, error } = await q;
  if (error) {
    console.error(`[portal/activations] list ${cfg.product}`, error.message);
    return serverError('Query failed.', instance);
  }
  const rows = (data as unknown as PortalActivationRow[]) || [];
  return withRateLimitHeaders(
    NextResponse.json(
      { activations: rows.map((r) => shape(r, cfg.product)) },
      { status: 200 }
    ),
    ctx
  );
}

export async function createActivation(request: NextRequest, cfg: ProductCfg) {
  const instance = cfg.basePath;
  const requiredScope: Scope = 'products.write';
  const auth = await requireAuth(request, {
    scope: requiredScope,
    group: 'products.write',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.', undefined, instance);
  }

  const parsed = cfg.schema.safeParse(body);
  if (!parsed.success) {
    return badRequest(
      'Activation request validation failed.',
      zodIssuesToValidationErrors(parsed.error.issues),
      instance
    );
  }
  const data = parsed.data as {
    listing_id?: string;
    customer_listing_id?: string;
    branch_id?: string;
    highlights?: { id: number }[];
  };

  // If customer_listing_id is set, ensure it belongs to this credential's
  // agent (prevents cross-tenant activation requests).
  if (data.customer_listing_id) {
    const { data: lookup } = await portalTable('tbl_portal_listings')
      .select('agent_id, branch_id')
      .eq('reference', data.customer_listing_id)
      .eq('agent_id', ctx.agent_id)
      .maybeSingle();
    if (!lookup) {
      return badRequest(
        `customer_listing_id "${data.customer_listing_id}" not found for this agent.`,
        undefined,
        instance
      );
    }
  }

  const insertBody = {
    product: cfg.product,
    status: 'PENDING' as const,
    client_id: ctx.client_id,
    branch_id: data.branch_id ?? ctx.branch_id_hint ?? null,
    customer_listing_id: data.customer_listing_id ?? null,
    listing_id: data.listing_id ?? null,
    request: data as unknown as object
  };

  const { data: insertedData, error } = await portalTable('tbl_portal_product_activations')
    .insert(insertBody)
    .select('*')
    .maybeSingle();

  if (error || !insertedData) {
    console.error(`[portal/activations] create ${cfg.product}`, error?.message);
    return serverError('Activation create failed.', instance);
  }
  const row = insertedData as unknown as PortalActivationRow;

  await audit('portal.activation.requested', {
    client_id: ctx.client_id,
    target: row.id,
    detail: {
      product: cfg.product,
      customer_listing_id: row.customer_listing_id,
      listing_id: row.listing_id
    }
  });

  return withRateLimitHeaders(
    NextResponse.json(shape(row, cfg.product), { status: 201 }),
    ctx
  );
}

export async function getActivation(
  request: NextRequest,
  cfg: ProductCfg,
  activation_id: string
) {
  const instance = `${cfg.basePath}/${activation_id}`;
  const auth = await requireAuth(request, {
    scope: 'feed.read',
    group: 'products.read',
    instance
  });
  if ('error' in auth) return auth.error;
  const ctx = auth.ctx;

  const { data, error } = await portalTable('tbl_portal_product_activations')
    .select('*')
    .eq('id', activation_id)
    .eq('product', cfg.product)
    .eq('client_id', ctx.client_id)
    .maybeSingle();

  if (error) {
    console.error(`[portal/activations] get ${cfg.product}`, error.message);
    return serverError('Query failed.', instance);
  }
  if (!data) return notFound('Activation not found.', instance);
  return withRateLimitHeaders(
    NextResponse.json(shape(data as unknown as PortalActivationRow, cfg.product), {
      status: 200
    }),
    ctx
  );
}
