/**
 * IndexNow: push added/changed/deleted URLs to Bing (and every IndexNow
 * engine - Seznam, Naver, Yandex share the endpoint) the moment they change,
 * instead of waiting to be re-crawled.
 *
 * The key is deliberately NOT a secret: the protocol verifies ownership by
 * fetching https://elumenuvo.com/<key>.txt (checked into /public), so
 * knowing the key only lets someone submit OUR OWN urls for our own host.
 *
 * Fire-and-forget by design: indexing pings must never slow down or fail a
 * product save. Skipped outside production so dev/preview servers never
 * submit localhost noise.
 */
const KEY = "8d35c001c42257f6efd9c3eae7689ac8";
const HOST = "elumenuvo.com";
const SITE = `https://${HOST}`;

export async function submitIndexNow(paths: string[]): Promise<void> {
  try {
    if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview") return;
    const urlList = [...new Set(paths)]
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? p : `/${p}`}`))
      .slice(0, 10000); // protocol cap per submission
    if (urlList.length === 0) return;
    // bing.com/indexnow, not api.indexnow.org: the aggregator kept returning
    // 403 SiteVerificationNotCompleted for this host (Aug 2026) while Bing's
    // own endpoint accepted the same payload with a 200 - and every IndexNow
    // engine shares submissions, so one working entry point covers them all.
    await fetch("https://www.bing.com/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList }),
    });
  } catch {
    /* never let an indexing ping break anything */
  }
}
