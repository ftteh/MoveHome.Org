// Canonical-JSON + SHA-256 helpers for deterministic payload hashing.
//
// JSON is unordered, so we recursively sort object keys before stringifying.
// This means `PUT` requests with the same logical payload (any key order) hash
// to the same digest and trigger NO_CHANGE on idempotent re-PUT.

import { createHash } from 'node:crypto';

export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      sorted[k] = canonicalize(obj[k]);
    }
    return sorted;
  }
  return value;
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}
