// Per-instance sliding window: resets on cold start and is NOT shared across
// Vercel functions/regions. Swap for Vercel KV / Upstash Redis at scale.
export class SlidingWindowLimiter {
  private readonly buckets = new Map<string, number[]>();
  constructor(private readonly limit = 10, private readonly windowMs = 60_000, private readonly maxKeys = 10_000) {}

  check(identifier: string, now = Date.now()) {
    // Bounded memory; remove inactive clients without a serverless background timer.
    this.buckets.forEach((hits, key) => {
      if (hits[hits.length - 1] <= now - this.windowMs) this.buckets.delete(key);
    });
    const hits = (this.buckets.get(identifier) ?? []).filter(time => time > now - this.windowMs);
    const capacityReached = !this.buckets.has(identifier) && this.buckets.size >= this.maxKeys;
    const allowed = !capacityReached && hits.length < this.limit;
    if (allowed) {
      hits.push(now);
      this.buckets.set(identifier, hits);
    }
    const reset = (hits[0] ?? now) + this.windowMs;
    return { allowed, limit: this.limit, remaining: Math.max(0, this.limit - hits.length), reset,
      retryAfter: Math.max(1, Math.ceil((reset - now) / 1000)) };
  }
}
const limiter = new SlidingWindowLimiter();
export function checkRateLimit(identifier: string) { return limiter.check(identifier); }

export function getClientIdentifier(headers: Headers): string {
  // On Vercel trust the platform-overwritten header, never arbitrary x-real-ip.
  // Outside Vercel the proxy must overwrite x-forwarded-for; local requests share a bucket.
  const header = process.env.VERCEL === '1' ? 'x-vercel-forwarded-for' : 'x-forwarded-for';
  return headers.get(header)?.split(',')[0]?.trim().slice(0, 128) || 'local';
}
