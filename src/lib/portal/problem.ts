// RFC 7807 problem+json helpers for the RAIA Portal Feed API.
//
// Every 4xx and 5xx response goes through these helpers so the wire format is
// uniform and includes a server-side trace_id for log correlation.

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

interface ProblemArgs {
  status: number;
  type?: string;
  title: string;
  detail?: string;
  instance?: string;
  validation_errors?: ValidationError[];
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://movehome.org';

export function newTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

export function problem(args: ProblemArgs): NextResponse {
  const trace_id = newTraceId();
  const body: Record<string, unknown> = {
    type: args.type || `${BASE_URL}/errors/${args.status}`,
    title: args.title,
    status: args.status,
    ...(args.detail ? { detail: args.detail } : {}),
    ...(args.instance ? { instance: args.instance } : {}),
    trace_id,
    timestamp: new Date().toISOString(),
    ...(args.validation_errors && args.validation_errors.length > 0
      ? { validation_errors: args.validation_errors }
      : {}),
    ...(args.extra || {})
  };
  const headers = new Headers({
    'Content-Type': 'application/problem+json',
    'X-Trace-Id': trace_id
  });
  if (args.headers) {
    for (const [k, v] of Object.entries(args.headers)) headers.set(k, v);
  }
  return NextResponse.json(body, { status: args.status, headers });
}

export function unauthorized(detail = 'Missing or invalid bearer token.', instance?: string) {
  return problem({
    status: 401,
    title: 'Unauthorized',
    detail,
    instance,
    type: `${BASE_URL}/errors/unauthorized`,
    headers: { 'WWW-Authenticate': 'Bearer realm="raia-portal-feed"' }
  });
}

export function forbidden(detail = 'Token scope does not permit this operation.', instance?: string) {
  return problem({
    status: 403,
    title: 'Forbidden',
    detail,
    instance,
    type: `${BASE_URL}/errors/forbidden`
  });
}

export function notFound(detail = 'Resource not found.', instance?: string) {
  return problem({
    status: 404,
    title: 'Not Found',
    detail,
    instance,
    type: `${BASE_URL}/errors/not-found`
  });
}

export function badRequest(
  detail: string,
  validation_errors?: ValidationError[],
  instance?: string
) {
  return problem({
    status: 400,
    title: 'Validation failed',
    detail,
    validation_errors,
    instance,
    type: `${BASE_URL}/errors/validation`
  });
}

export function conflict(detail: string, instance?: string) {
  return problem({
    status: 409,
    title: 'Conflict',
    detail,
    instance,
    type: `${BASE_URL}/errors/conflict`
  });
}

export function tooManyRequests(retryAfterSeconds: number, limit: number, resetUnix: number, instance?: string) {
  return problem({
    status: 429,
    title: 'Too Many Requests',
    detail: `Rate limit exceeded. Retry after ${retryAfterSeconds} seconds.`,
    instance,
    type: `${BASE_URL}/errors/rate-limit`,
    headers: {
      'Retry-After': String(retryAfterSeconds),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': String(resetUnix)
    }
  });
}

export function serverError(detail = 'Internal server error.', instance?: string) {
  return problem({
    status: 500,
    title: 'Internal Server Error',
    detail,
    instance,
    type: `${BASE_URL}/errors/server`
  });
}
