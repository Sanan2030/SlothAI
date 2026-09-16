import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { getRegistry } from '@/lib/strategies/bootstrap';
import { StrategyNotFoundError } from '@/lib/strategies/registry';
import { transformationSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function readBody(req: NextRequest): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new AppError('INVALID_JSON', 'JSON sorğu gövdəsi tələb olunur.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      // Allows 10k characters including JSON Unicode escapes, while bounding allocation.
      if (size > 100_000) {
        await reader.cancel();
        throw new AppError('BODY_TOO_LARGE', 'Sorğu gövdəsi həddindən artıq böyükdür.', 400);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('INVALID_JSON', 'Sorğu düzgün JSON formatında deyil.', 400);
  } finally { reader.releaseLock(); }
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit(getClientIdentifier(req.headers));
  const headers = { 'Cache-Control': 'no-store', 'X-RateLimit-Limit': String(rate.limit),
    'X-RateLimit-Remaining': String(rate.remaining), 'X-RateLimit-Reset': String(Math.ceil(rate.reset / 1000)) };
  if (!rate.allowed) return NextResponse.json({ error: { code: 'RATE_LIMITED',
    message: 'Sorğu limiti aşılıb. Bir az sonra yenidən cəhd edin.' } },
    { status: 429, headers: { ...headers, 'Retry-After': String(rate.retryAfter) } });
  try {
    if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      throw new AppError('INVALID_CONTENT_TYPE', 'Content-Type application/json olmalıdır.', 400);
    }
    const validation = transformationSchema.safeParse(await readBody(req));
    if (!validation.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR',
      message: 'Sorğu məlumatlarını yoxlayın.', issues: validation.error.issues.map(({ path, message }) => ({ path, message })) } }, { status: 400, headers });
    const registry = await getRegistry();
    const result = await registry.get(validation.data.strategyId).transform(validation.data);
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof StrategyNotFoundError) return NextResponse.json({ error: {
      code: 'UNKNOWN_STRATEGY', message: 'Seçilmiş emal növü tapılmadı.' } }, { status: 400, headers });
    const known = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 'Daxili server xətası.');
    return NextResponse.json({ error: { code: known.code, message: known.message } }, { status: known.status, headers });
  }
}
