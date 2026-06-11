// GET /api/raia/portal/v1/healthz — unauthenticated liveness probe.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      version: '0.1.0',
      service: 'raia-portal-feed-api',
      checked_at: new Date().toISOString()
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
