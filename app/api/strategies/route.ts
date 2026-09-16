import { NextResponse } from 'next/server';
import { getRegistry } from '@/lib/strategies/bootstrap';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json({ strategies: (await getRegistry()).listStrategies() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: { code: 'REGISTRY_ERROR', message: 'Emal növləri yüklənə bilmədi.' } }, { status: 500 });
  }
}
