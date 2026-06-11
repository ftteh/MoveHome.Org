import type { NextRequest } from 'next/server';
import { Cfg, getActivation } from '@/lib/portal/activations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ activation_id: string }> }
) {
  const { activation_id } = await params;
  return getActivation(request, Cfg.premium, activation_id);
}
