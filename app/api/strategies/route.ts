import { NextResponse } from 'next/server';
import { getStrategyRegistry } from '@/lib/strategies/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(getStrategyRegistry().listStrategies(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ error: 'Strategiyalar yüklənə bilmədi.' }, {
      status: 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
