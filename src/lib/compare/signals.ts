import { adminClient } from "@/lib/supabase/admin";

/**
 * The learning layer of the compare rail: which alternatives do shoppers
 * actually engage with?
 *
 * The storefront logs `compare_pick` (clicked through to the alternative)
 * and `compare_add` (added it to cart from the rail) into site_events. Here
 * they become per-product boosts that order the rail - an alternative people
 * keep choosing drifts to the front, one nobody touches drifts back. Adds
 * weigh 3x clicks. 60-day window, 10-minute cache, and the whole thing fails
 * open to a zero-boost map so the rail still renders (price-ordered) if
 * analytics is unavailable.
 */
let cache: { at: number; boosts: Map<string, number> } | null = null;
const TTL_MS = 10 * 60_000;

export async function loadCompareBoosts(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.boosts;
  const boosts = new Map<string, number>();
  try {
    const db = adminClient();
    if (db) {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const { data } = await db
        .from("site_events")
        .select("type, detail")
        .in("type", ["compare_pick", "compare_add"])
        .gte("created_at", since)
        .limit(8000);
      for (const r of (data ?? []) as { type: string; detail: { to?: string } | null }[]) {
        const to = r.detail?.to;
        if (typeof to === "string" && to) boosts.set(to, (boosts.get(to) ?? 0) + (r.type === "compare_add" ? 3 : 1));
      }
    }
  } catch { /* fail open: unranked rail beats no rail */ }
  cache = { at: Date.now(), boosts };
  return boosts;
}
