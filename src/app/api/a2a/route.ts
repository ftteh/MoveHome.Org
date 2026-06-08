// A2A (Google Agent2Agent) JSON-RPC endpoint for MoveHome.org.
//
//   POST /api/a2a    — JSON-RPC 2.0: message/send, tasks/get
//   GET  /api/a2a    — returns the Agent Card (discovery convenience)
//   OPTIONS          — CORS preflight (the endpoint is open to anonymous agents)
//
// message/send carries a Message whose parts include a DataPart of the form
//   { "kind": "data", "data": { "skill": "search_properties", "params": { … } } }
// We answer synchronously and return a terminal (completed) Task. There is no
// task persistence in v1, so tasks/get always reports the task as unknown.

import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { buildAgentCard } from '@/lib/a2a/card';
import {
  RpcErrorCode,
  RpcException,
  rpcErrorResponse,
  rpcRequestSchema,
  rpcSuccess,
  type RpcId
} from '@/lib/a2a/rpc';
import { resolveSkill } from '@/lib/a2a/skills';
import type { Message, Task } from '@/lib/a2a/types';
import { enforceRateLimit, rateLimitHeaders } from '@/lib/portal/rate-limit';

export const dynamic = 'force-dynamic';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

function json(body: unknown, status = 200, extra?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, ...(extra ?? {}) } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export function GET() {
  return json(buildAgentCard());
}

// Best-effort per-IP rate limit. Fails open if the limiter store is unavailable
// (e.g. local dev without Supabase env) — discovery/search stay usable.
async function checkRateLimit(req: Request): Promise<{ ok: boolean; headers: Record<string, string>; retryAfter: number }> {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = fwd || req.headers.get('x-real-ip') || 'unknown';
  const ipKey = `a2a:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
  try {
    const decision = await enforceRateLimit(ipKey, 'a2a');
    return { ok: decision.ok, headers: rateLimitHeaders(decision), retryAfter: decision.retryAfter };
  } catch {
    return { ok: true, headers: {}, retryAfter: 0 };
  }
}

// Build a terminal Task from a skill result.
function completedTask(summary: string, artifacts: Task['artifacts']): Task {
  const id = randomUUID();
  const contextId = randomUUID();
  const agentMessage: Message = {
    kind: 'message',
    role: 'agent',
    parts: [{ kind: 'text', text: summary }],
    messageId: randomUUID(),
    taskId: id,
    contextId
  };
  return {
    kind: 'task',
    id,
    contextId,
    status: { state: 'completed', message: agentMessage, timestamp: new Date().toISOString() },
    artifacts: artifacts ?? []
  };
}

// Pull the { skill, params } DataPart out of an incoming message/send payload.
function extractSkillInvocation(params: unknown): { skill: string; params: unknown } {
  const message = (params as { message?: unknown })?.message as Message | undefined;
  if (!message || !Array.isArray(message.parts)) {
    throw new RpcException(
      RpcErrorCode.InvalidParams,
      'message/send requires a `message` object with a `parts` array.'
    );
  }
  for (const part of message.parts) {
    if (part.kind === 'data' && part.data && typeof part.data.skill === 'string') {
      return { skill: part.data.skill, params: part.data.params ?? {} };
    }
  }
  throw new RpcException(
    RpcErrorCode.InvalidParams,
    'No skill invocation found. Include a DataPart: { "kind": "data", "data": { "skill": "search_properties", "params": { … } } }.'
  );
}

async function handleMethod(method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case 'message/send': {
      const { skill, params: skillParams } = extractSkillInvocation(params);
      const handler = resolveSkill(skill);
      if (!handler) {
        throw new RpcException(RpcErrorCode.InvalidParams, `Unknown skill: ${skill}.`);
      }
      const result = await handler(skillParams);
      return completedTask(result.summary, result.artifacts);
    }
    case 'tasks/get':
      // Stateless: we never persist tasks, so any id is unknown.
      throw new RpcException(RpcErrorCode.TaskNotFound, 'Task not found (this agent does not persist tasks).');
    default:
      throw new RpcException(RpcErrorCode.MethodNotFound, `Unknown method: ${method}.`);
  }
}

export async function POST(req: Request) {
  // Parse body.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(rpcErrorResponse(null, { code: RpcErrorCode.ParseError, message: 'Invalid JSON.' }), 400);
  }

  // Validate JSON-RPC envelope.
  const parsed = rpcRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const id = (raw as { id?: RpcId })?.id ?? null;
    return json(
      rpcErrorResponse(id, { code: RpcErrorCode.InvalidRequest, message: 'Invalid JSON-RPC 2.0 request.' }),
      400
    );
  }
  const { id = null, method, params } = parsed.data;

  // Rate limit.
  const rl = await checkRateLimit(req);
  if (!rl.ok) {
    return json(
      rpcErrorResponse(id, { code: RpcErrorCode.InternalError, message: 'Rate limit exceeded.' }),
      429,
      { ...rl.headers, 'Retry-After': String(rl.retryAfter) }
    );
  }

  // Dispatch.
  try {
    const result = await handleMethod(method, params);
    return json(rpcSuccess(id, result), 200, rl.headers);
  } catch (e) {
    if (e instanceof RpcException) {
      return json(
        rpcErrorResponse(id, { code: e.code, message: e.message, data: e.data }),
        200,
        rl.headers
      );
    }
    console.error('[a2a] unexpected error', e);
    return json(
      rpcErrorResponse(id, { code: RpcErrorCode.InternalError, message: 'Internal error.' }),
      200,
      rl.headers
    );
  }
}
