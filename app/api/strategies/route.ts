import { NextResponse } from 'next/server';
import { getStrategyRegistry } from '@/lib/strategies/bootstrap';
import { getProvider, UnsupportedProviderError } from '@/lib/llm/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getProvider();
    return NextResponse.json(getStrategyRegistry().listStrategies(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof UnsupportedProviderError) {
      return NextResponse.json({ error: error.message, code: error.code }, {
        status: 400, headers: { 'Cache-Control': 'no-store' },
      });
    }
    return NextResponse.json({ error: 'Strategiyalar yüklənə bilmədi.' }, {
      status: 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
