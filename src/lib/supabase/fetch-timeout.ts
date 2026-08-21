/** Fail-fast fetch for server-side Supabase clients.
 *
 *  During the 21 Aug 2026 outage every storefront function sat on a dead
 *  PostgREST socket until Vercel's maxDuration (minutes), which is billed as
 *  provisioned memory the whole time and made pages hang instead of failing.
 *  No single PostgREST request in this codebase legitimately takes more than
 *  a few seconds (the largest, a 1,000-row admin chunk, is ~3 s), so a 20 s
 *  ceiling only ever fires when the database is unhealthy. Callers already
 *  treat errors as "serve the fallback": cached catalogue, empty rails,
 *  skipped analytics. A caller-supplied signal wins over the ceiling. */
export const SUPABASE_TIMEOUT_MS = 20_000;

export const timeoutFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(SUPABASE_TIMEOUT_MS) });
