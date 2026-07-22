/**
 * In-memory sliding-window rate limiter for public ingest endpoints.
 * Per serverless instance (not global) — the goal is stopping abusive
 * loops and junk floods cheaply, not perfect distributed quotas. Memory is
 * bounded by periodic pruning.
 */

type Window = { times: number[] };
const buckets = new Map<string, Window>();
let lastPrune = Date.now();

/** True when `key` has exceeded `max` hits in the past `windowMs`. */
export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();

  // Prune old buckets occasionally so long-lived instances don't grow forever.
  if (now - lastPrune > 5 * 60_000) {
    lastPrune = now;
    for (const [k, w] of buckets) {
      if (!w.times.length || now - w.times[w.times.length - 1] > 10 * 60_000) buckets.delete(k);
    }
  }

  const w = buckets.get(key) ?? { times: [] };
  w.times = w.times.filter((t) => now - t < windowMs);
  if (w.times.length >= max) { buckets.set(key, w); return true; }
  w.times.push(now);
  buckets.set(key, w);
  return false;
}

/** Client IP from proxy headers (first hop). */
export function requestIp(h: Headers): string {
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}
