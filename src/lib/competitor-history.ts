/** Public read of competitor price history for the per-product comparison chart.
 *  The competitor_price_history table has a public-read RLS policy (prices only,
 *  no internal codes). Read via the anon client. */
import { createClient } from "@supabase/supabase-js";

export type CompetitorPoint = { source: string; comparable: number | null; net: number | null; list: number | null; our: number | null; at: string };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Public-safe market series: our price + the blended market average per
 *  capture. Competitor identity (source, per-competitor prices) is aggregated
 *  away server-side so it never reaches the browser. */
export type MarketPoint = { at: string; our: number | null; marketAvg: number | null };

export async function fetchMarketHistory(productId: string): Promise<MarketPoint[]> {
  const points = await fetchCompetitorHistory(productId);
  const byTime = new Map<string, { our: number | null; comps: number[] }>();
  for (const p of points) {
    const e = byTime.get(p.at) ?? { our: null, comps: [] };
    if (p.our != null) e.our = p.our;
    if (p.comparable != null) e.comps.push(p.comparable);
    byTime.set(p.at, e);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([at, e]) => ({
      at,
      our: e.our,
      marketAvg: e.comps.length ? Math.round((e.comps.reduce((a, b) => a + b, 0) / e.comps.length) * 100) / 100 : null,
    }));
}

/**
 * Unified price history for the product page — shown for ALL products: the
 * Elume price over time (from price_history, seeded for every product) plus a
 * blended market-average line at each competitor sync (mapped products only).
 * `currentPrice` guarantees at least one point if the table is empty.
 */
export async function fetchPriceHistory(productId: string, currentPrice?: number): Promise<MarketPoint[]> {
  const c = client();
  const marketByTime = new Map<string, number>();
  const ourPoints: { at: string; our: number }[] = [];

  if (c) {
    try {
      const { data } = await c
        .from("price_history")
        .select("elume_price, captured_at")
        .eq("product_id", productId)
        .order("captured_at", { ascending: true })
        .limit(200);
      for (const r of (data ?? []) as any[]) ourPoints.push({ at: r.captured_at, our: Number(r.elume_price) });
    } catch { /* table may not exist yet */ }

    // Market average per capture, from competitor history (mapped products only).
    const comp = await fetchCompetitorHistory(productId);
    const byTime = new Map<string, number[]>();
    for (const p of comp) if (p.comparable != null) (byTime.get(p.at) ?? byTime.set(p.at, []).get(p.at)!).push(p.comparable);
    for (const [at, vals] of byTime) marketByTime.set(at, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
  }

  // Ensure at least one Elume point (today) so the chart renders for everyone.
  if (ourPoints.length === 0 && currentPrice != null) ourPoints.push({ at: new Date(0).toISOString(), our: currentPrice });

  // Union of timestamps; carry the Elume price forward (step line), attach
  // market average where a competitor sync exists.
  const times = Array.from(new Set([...ourPoints.map((p) => p.at), ...marketByTime.keys()])).sort();
  let lastOur: number | null = ourPoints[0]?.our ?? currentPrice ?? null;
  const ourAt = new Map(ourPoints.map((p) => [p.at, p.our]));
  return times.map((at) => {
    if (ourAt.has(at)) lastOur = ourAt.get(at)!;
    return { at, our: lastOur, marketAvg: marketByTime.get(at) ?? null };
  });
}

export async function fetchCompetitorHistory(productId: string): Promise<CompetitorPoint[]> {
  const c = client();
  if (!c) return [];
  try {
    const { data, error } = await c
      .from("competitor_price_history")
      .select("source, comparable_price, net_price, list_price, our_price, captured_at")
      .eq("product_id", productId)
      .order("captured_at", { ascending: true })
      .limit(200);
    if (error || !data) return [];
    return data.map((r: any) => ({ source: r.source, comparable: r.comparable_price, net: r.net_price, list: r.list_price, our: r.our_price, at: r.captured_at }));
  } catch {
    return [];
  }
}
