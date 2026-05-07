import { NextResponse } from 'next/server';
import { getSupabase, isConfigured } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isConfigured) {
    return NextResponse.json(
      { status: 'unconfigured', supabase: false },
      { status: 503 }
    );
  }
  const sb = getSupabase()!;
  const { error } = await sb.from('tbl_listings').select('raia_id').limit(1);
  return NextResponse.json({
    status: error ? 'degraded' : 'ok',
    supabase: !error,
    error: error?.message ?? null
  });
}
