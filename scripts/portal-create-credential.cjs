#!/usr/bin/env node
/* eslint-disable no-console */
// Provision a new RAIA Portal Feed API credential.
//
// Usage:
//   node scripts/portal-create-credential.cjs \
//     --agent-id org-gb-acme \
//     --label "Acme CRM staging" \
//     --scopes feed.write,feed.read,products.write \
//     [--branch-id 56726] [--rate-limit 60]
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local).
// Prints client_id + client_secret ONCE to stdout. Store securely and share
// with the integrator over an out-of-band secure channel.

const { createClient } = require('@supabase/supabase-js');
const { randomBytes, scryptSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function loadDotEnvLocal() {
  const candidate = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(candidate)) return;
  const text = fs.readFileSync(candidate, 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}
loadDotEnvLocal();

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = v;
        i++;
      }
    }
  }
  return out;
}

function hashClientSecret(plaintext) {
  const salt = randomBytes(16);
  const hash = scryptSync(plaintext, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const agent_id = args['agent-id'];
  const label = args.label || null;
  const branchId = args['branch-id'] || null;
  const rateLimit = args['rate-limit'] ? parseInt(args['rate-limit'], 10) : 60;
  const scopes = (args.scopes || 'feed.read,feed.write')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!agent_id) {
    console.error('Missing --agent-id (must exist in tbl_raia_agent_registry).');
    process.exit(1);
  }
  for (const s of scopes) {
    if (!['feed.read', 'feed.write', 'products.write'].includes(s)) {
      console.error(`Invalid scope: ${s}`);
      process.exit(1);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Confirm the agent exists.
  const { data: agent, error: agentErr } = await sb
    .from('tbl_raia_agent_registry')
    .select('agent_id, verification_status')
    .eq('agent_id', agent_id)
    .maybeSingle();
  if (agentErr) {
    console.error('Agent lookup failed:', agentErr.message);
    process.exit(1);
  }
  if (!agent) {
    console.error(`Agent ${agent_id} not in tbl_raia_agent_registry. Add the row first.`);
    process.exit(1);
  }
  if (agent.verification_status !== 'approved') {
    console.warn(
      `Warning: agent ${agent_id} verification_status is ${agent.verification_status}. ` +
        'Listings from this credential will still flow through, but their public ' +
        'cards may not surface in search until the agent is approved.'
    );
  }

  const client_id = `pcid_${randomBytes(18).toString('base64url')}`;
  const client_secret = randomBytes(32).toString('base64url');

  const { error } = await sb.from('tbl_portal_credentials').insert({
    client_id,
    secret_hash: hashClientSecret(client_secret),
    label,
    allowed_scopes: scopes,
    agent_id,
    default_branch_id: branchId,
    rate_limit_per_min: rateLimit
  });
  if (error) {
    console.error('Credential insert failed:', error.message);
    process.exit(1);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' RAIA Portal Feed API — credential issued');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(` agent_id        : ${agent_id}`);
  console.log(` label           : ${label || '(none)'}`);
  console.log(` allowed scopes  : ${scopes.join(' ')}`);
  console.log(` default branch  : ${branchId || '(none)'}`);
  console.log(` rate limit      : ${rateLimit}/min/endpoint-group`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(` client_id       : ${client_id}`);
  console.log(` client_secret   : ${client_secret}`);
  console.log('───────────────────────────────────────────────────────────────');
  console.log(' STORE THE SECRET NOW. It is not stored in cleartext and');
  console.log(' cannot be recovered. Issue a new credential to rotate.');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
