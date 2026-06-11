import type { NextRequest } from 'next/server';
import { Cfg, createActivation, listActivations } from '@/lib/portal/activations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return listActivations(request, Cfg.premium);
}
export async function POST(request: NextRequest) {
  return createActivation(request, Cfg.premium);
}
