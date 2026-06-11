// scrypt-based password hashing for OAuth client_secret values + helpers for
// constant-time comparison and cryptographically random secret generation.
//
// Security choices:
//   - scrypt (Node built-in, memory-hard, comparable to bcrypt/argon2 for our
//     threat model: rate-limited login + offline-resistant if DB leaks).
//   - 16-byte random salt per credential.
//   - 32-byte derived key.
//   - N=2^14, r=8, p=1 (interactive auth tier; ~10ms per verify on a small
//     Vercel container).
//   - timingSafeEqual for both hash compare and Basic header decode compare.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;

export function hashClientSecret(plaintext: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyClientSecret(plaintext: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1], 'base64');
    expected = Buffer.from(parts[2], 'base64');
  } catch {
    return false;
  }
  if (expected.length !== KEY_LEN) return false;
  const candidate = scryptSync(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });
  return timingSafeEqual(candidate, expected);
}

export function generateClientId(): string {
  // pcid_<24 url-safe base64 chars> → matches CHECK pattern.
  return `pcid_${randomBytes(18).toString('base64url')}`;
}

export function generateClientSecret(): string {
  // 32 random bytes encoded url-safe — 43 chars.
  return randomBytes(32).toString('base64url');
}

export function safeEqualString(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
