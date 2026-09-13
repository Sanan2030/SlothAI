import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { checkRateLimit } from '@/lib/rate-limit';
import { getStrategyRegistry } from '@/lib/strategies/bootstrap';
import { StrategyNotFoundError } from '@/lib/strategies/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  strategyId: z.string().trim().min(1).max(64),
  text: z
    .string()
    .trim()
    .min(1, 'Mətn boş ola bilməz.')
    .max(10_000, 'Mətn maksimum 10,000 simvol ola bilər.'),
  options: z
    .object({
      tone: z.enum(['default', 'formal', 'casual']).optional(),
      preserveFormatting: z.boolean().optional(),
      customRules: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
    })
    .optional(),
});

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `transform:${ip}`;
}

export async function POST(req: NextRequest) {
  const rate = await checkRateLimit(getClientIdentifier(req));
  const rateHeaders = {
    'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(rate.remaining),
    'X-RateLimit-Reset': String(rate.reset),
  };

  if (!rate.success) {
    return NextResponse.json(
      { error: 'Sorğu limiti aşılıb. Bir az sonra yenidən cəhd edin.' },
      { status: 429, headers: rateHeaders },
    );
  }

  try {
    const body: unknown = await req.json();
    const data = RequestSchema.parse(body);
    const strategy = getStrategyRegistry().get(data.strategyId);
    const result = await strategy.transform({ text: data.text, options: data.options });

    return NextResponse.json(result, {
      status: 200,
      headers: {
        ...rateHeaders,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasiya xətası.', details: error.issues },
        { status: 400, headers: rateHeaders },
      );
    }

    if (error instanceof StrategyNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: rateHeaders },
      );
    }

    console.error('POST /api/transform failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daxili server xətası.' },
      { status: 500, headers: rateHeaders },
    );
  }
}
