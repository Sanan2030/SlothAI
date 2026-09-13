import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const limit = Math.max(1, Number(process.env.RATE_LIMIT_REQUESTS ?? 20));
const windowSeconds = Math.max(1, Number(process.env.RATE_LIMIT_WINDOW_SECONDS ?? 60));

let distributedLimiter: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  distributedLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s` as `${number} s`),
    analytics: true,
    prefix: 'slothai:ratelimit',
  });
}

interface LocalBucket {
  count: number;
  resetAt: number;
}

const localBuckets = new Map<string, LocalBucket>();

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  if (distributedLimiter) {
    const result = await distributedLimiter.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }

  const now = Date.now();
  const existing = localBuckets.get(identifier);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowSeconds * 1000 }
    : existing;

  bucket.count += 1;
  localBuckets.set(identifier, bucket);

  return {
    success: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
  };
}
