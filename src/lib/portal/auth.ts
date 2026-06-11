// Bearer-token authentication middleware for RAIA Portal Feed API routes.
//
// Verifies HS256 JWT, checks scope, looks up the credential row to confirm it
// hasn't been revoked since the token was issued, and stamps last_used_at.

import type { NextRequest } from 'next/server';
import {
  type PortalAccessTokenClaims,
  verifyPortalAccessToken
} from './jwt';
import { portalTable, type PortalCredentialRow } from './db';
import {
  enforceRateLimit,
  rateLimitHeaders,
  type EndpointGroup,
  type RateLimitDecision
} from './rate-limit';
import {
  forbidden,
  tooManyRequests,
  unauthorized
} from './problem';
import { NextResponse } from 'next/server';

export type Scope = 'feed.read' | 'feed.write' | 'products.write';

export interface AuthContext {
  client_id: string;
  agent_id: string;
  scopes: Scope[];
  branch_id_hint?: string;
  rate_limit: RateLimitDecision;
}

interface RequireAuthArgs {
  scope: Scope;
  group: EndpointGroup;
  instance: string;
}

export async function requireAuth(
  request: NextRequest,
  args: RequireAuthArgs
): Promise<{ ctx: AuthContext } | { error: NextResponse }> {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return { error: unauthorized('Missing Authorization: Bearer header.', args.instance) };
  }
  const token = header.slice(7).trim();
  if (!token) {
    return { error: unauthorized('Empty bearer token.', args.instance) };
  }

  const verified = verifyPortalAccessToken(token);
  if (!verified.ok) {
    const detail =
      verified.reason === 'expired'
        ? 'Token expired.'
        : 'Invalid bearer token.';
    return { error: unauthorized(detail, args.instance) };
  }

  const claims: PortalAccessTokenClaims = verified.claims;
  const scopes = claims.scope.split(/\s+/).filter(Boolean) as Scope[];

  if (!scopes.includes(args.scope)) {
    return {
      error: forbidden(
        `Required scope "${args.scope}" not granted on this token.`,
        args.instance
      )
    };
  }

  const { data: credData } = await portalTable('tbl_portal_credentials')
    .select('client_id, agent_id, revoked_at, rate_limit_per_min, default_branch_id')
    .eq('client_id', claims.sub)
    .maybeSingle();
  const cred = credData as PortalCredentialRow | null;

  if (!cred || cred.revoked_at) {
    return {
      error: unauthorized('Credential revoked or unknown.', args.instance)
    };
  }

  const rl = await enforceRateLimit(
    cred.client_id,
    args.group,
    cred.rate_limit_per_min
  );
  if (!rl.ok) {
    return {
      error: tooManyRequests(rl.retryAfter, rl.limit, rl.resetUnix, args.instance)
    };
  }

  // Async-fire last_used stamping; don't await — best effort.
  void portalTable('tbl_portal_credentials')
    .update({ last_used_at: new Date().toISOString() })
    .eq('client_id', cred.client_id);

  return {
    ctx: {
      client_id: cred.client_id,
      agent_id: cred.agent_id,
      scopes,
      branch_id_hint: claims.branch_id || cred.default_branch_id || undefined,
      rate_limit: rl
    }
  };
}

export function withRateLimitHeaders(res: NextResponse, ctx: AuthContext): NextResponse {
  const headers = rateLimitHeaders(ctx.rate_limit);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}
