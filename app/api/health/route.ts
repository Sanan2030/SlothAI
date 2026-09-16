import { NextResponse } from 'next/server';
import { getRegistry } from '@/lib/strategies/bootstrap';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  await getRegistry();
  return NextResponse.json({ status: 'ok', service: 'lazy.ai' }, { headers: { 'Cache-Control': 'no-store' } });
}
