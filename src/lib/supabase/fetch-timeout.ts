/** Fail-fast fetch for server-side Supabase clients.
 *
 *  During the 21 Aug 2026 outage every storefront function sat on a dead
 *  PostgREST socket until Vercel's maxDuration (minutes), which is billed as
 *  provisioned memory the whole time and made pages hang instead of failing.
 *  No single PostgREST request in this codebase legitimately takes more than
 *  a few seconds (the largest, a 1,000-row admin chunk, is ~3 s), so a 60 s
 *  ceiling only ever fires when the database is unhealthy. (This is the
 *  server-to-database leg, never the visitor's own connection.) Callers already
 *  treat errors as "serve the fallback": cached catalogue, empty rails,
 *  skipped analytics.
 *
 *  Two details that matter:
 *  - The abort must surface as an AbortError. postgrest-js 2.108 retries GET
 *    failures up to three times with backoff and only short-circuits on
 *    name === "AbortError"; AbortSignal.timeout() rejects with a
 *    TimeoutError, which would turn a 20 s ceiling into ~90 s of retries.
 *    So we abort an AbortController ourselves.
 *  - Passing any signal opts the call out of Next's per-render fetch
 *    de-duplication. Accepted: the catalogue has its own data cache and
 *    per-instance memo, and the remaining duplicates are single-row reads.
 *  A caller-supplied signal wins over the ceiling. */
export const SUPABASE_TIMEOUT_MS = 60_000; // owner call, 21 Aug 2026: a full minute

export const timeoutFetch: typeof fetch = (input, init) => {
  if (init?.signal) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};
