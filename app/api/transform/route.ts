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
    .max(10_000, 'Mətn maksimum 10,000 simvol ola bilər.')
    .refine(value => value.trim().length > 0, 'Mətn boş ola bilməz.'),
  options: z
    .object({
      preserveFormatting: z.boolean().optional(),
    })
    .strict()
    .optional(),
});

function getClientIdentifier(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `transform:${ip}`;
}

export async function POST(req: NextRequest) {
  let rateHeaders: Record<string, string> = { 'Cache-Control': 'no-store' };
  try {
    const rate = await checkRateLimit(getClientIdentifier(req));
    rateHeaders = {
      'Cache-Control': 'no-store',
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

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Sorğu düzgün JSON formatında deyil.' }, { status: 400, headers: rateHeaders });
    }
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

    return NextResponse.json(
      { error: 'Mətn emal edilə bilmədi.' },
      { status: 500, headers: rateHeaders },
    );
  }
}
