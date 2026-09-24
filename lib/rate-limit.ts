// The optional same-origin HTTP endpoint is limited locally. The browser editor
// never calls it. No Redis/network access or environment variables are needed.
// Best-effort per-instance protection: resets on cold starts and is not shared
// across Vercel functions. Use a shared store before offering a public API SLA.
const requests = new Map<string, number[]>();
const limit = 30;
const windowMs = 60_000;
export async function checkRateLimit(identifier: string) {
  const now = Date.now();
  requests.forEach((hits, key) => {
    if (hits[hits.length - 1] <= now - windowMs) requests.delete(key);
  });
  const hits = (requests.get(identifier) ?? []).filter(time => time > now - windowMs);
  const capacity = !requests.has(identifier) && requests.size >= 10_000;
  const success = !capacity && hits.length < limit;
  if (success) { hits.push(now); requests.set(identifier, hits); }
  return { success, limit, remaining: Math.max(0, limit - hits.length), reset: (hits[0] ?? now) + windowMs };
}
