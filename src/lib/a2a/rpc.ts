// JSON-RPC 2.0 envelope handling for the A2A endpoint. Hand-rolled (zod-backed)
// to avoid an SDK dependency — the surface is just request parsing, the standard
// error codes, and success/error response builders.

import { z } from 'zod';

export const JSONRPC_VERSION = '2.0';

// id may be string, number, or null (JSON-RPC 2.0). We echo it back verbatim.
export type RpcId = string | number | null;

export const rpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional()
});

export type RpcRequest = z.infer<typeof rpcRequestSchema>;

// Standard JSON-RPC codes + A2A-specific extensions (-32000 range).
export const RpcErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  TaskNotFound: -32001
} as const;

export interface RpcError {
  code: number;
  message: string;
  data?: unknown;
}

export function rpcSuccess(id: RpcId, result: unknown) {
  return { jsonrpc: JSONRPC_VERSION, id: id ?? null, result };
}

export function rpcErrorResponse(id: RpcId, error: RpcError) {
  return { jsonrpc: JSONRPC_VERSION, id: id ?? null, error };
}

// Thrown by skill handlers to short-circuit into a JSON-RPC error response.
export class RpcException extends Error {
  code: number;
  data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcException';
    this.code = code;
    this.data = data;
  }
}

// Format a zod error into the JSON-RPC error `data` payload for InvalidParams.
export function zodErrorData(err: z.ZodError): { validation_errors: { field: string; message: string }[] } {
  return {
    validation_errors: err.issues.map((i) => ({
      field: i.path.join('.') || '(root)',
      message: i.message
    }))
  };
}
