import { NextResponse } from 'next/server';

import { getStrategyRegistry } from '@/lib/strategies/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getStrategyRegistry().listStrategies(), {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
