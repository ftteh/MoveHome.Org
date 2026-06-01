// Minimal HS256 JWT implementation for the RAIA Portal Feed API access tokens.
//
// The spec recommends RS256 because that lets clients verify tokens against a
// public key without contacting the issuer. In our deployment MoveHome both
// issues and validates tokens, so a symmetric secret is equivalent in security
// and avoids RSA key management. If a future deployment needs to publish a
// JWKS for downstream verifiers, swap the sign/verify pair to RS256.
//
// Secret: process.env.RAIA_PORTAL_JWT_SECRET (required, ≥32 bytes recommended).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALG = 'HS256';

interface SignArgs {
  sub: string;             // client_id
  scope: string;           // space-delimited scope list
  agent_id: string;
  branch_id?: string;
  expiresInSeconds: number;
}

export interface PortalAccessTokenClaims {
  iss: 'movehome.org';
  sub: string;
  scope: string;
  agent_id: string;
  branch_id?: string;
  iat: number;
  exp: number;
  jti: string;
}

function getSecret(): Buffer {
  const s = process.env.RAIA_PORTAL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      'RAIA_PORTAL_JWT_SECRET missing or shorter than 32 chars. ' +
        'Generate with: openssl rand -base64 48'
    );
  }
  return Buffer.from(s, 'utf8');
}

function b64urlEncode(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

function sign(payload: object): string {
  const header = { alg: ALG, typ: 'JWT' };
  const headerB64 = b64urlEncode(JSON.stringify(header));
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const sig = createHmac('sha256', getSecret()).update(data).digest();
  return `${data}.${b64urlEncode(sig)}`;
}

export function issuePortalAccessToken(args: SignArgs): {
  token: string;
  expiresAt: number;
  jti: string;
} {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + args.expiresInSeconds;
  const jti = `pjti_${randomBytes(12).toString('base64url')}`;
  const claims: PortalAccessTokenClaims = {
    iss: 'movehome.org',
    sub: args.sub,
    scope: args.scope,
    agent_id: args.agent_id,
    ...(args.branch_id ? { branch_id: args.branch_id } : {}),
    iat: now,
    exp,
    jti
  };
  return { token: sign(claims), expiresAt: exp, jti };
}

export type VerifyResult =
  | { ok: true; claims: PortalAccessTokenClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'wrong_alg' };

export function verifyPortalAccessToken(token: string): VerifyResult {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: PortalAccessTokenClaims;
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
    claims = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (header.alg !== ALG) return { ok: false, reason: 'wrong_alg' };

  const expected = createHmac('sha256', getSecret())
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  let received: Buffer;
  try {
    received = b64urlDecode(sigB64);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (received.length !== expected.length) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (!timingSafeEqual(received, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, claims };
}
