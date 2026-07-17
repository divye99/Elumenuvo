/** Public read of price history for the per-product chart.
 *  Both history tables have public-read RLS policies (prices only, no internal
 *  codes); reads go through the anon client. Competitor identity is aggregated
 *  away server-side: the storefront only ever sees an AVG market price. */
import { createClient } from "@supabase/supabase-js";

export type CompetitorPoint = { source: string; comparable: number | null; net: number | null; list: number | null; our: number | null; at: string };

/** One chart point per DAY: our price + the average market price across every
 *  approved seller logged that day (see migration 0048's daily snapshots). */
export type MarketPoint = { at: string; our: number | null; marketAvg: number | null };

const WINDOW_DAYS = 120;

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * Unified daily price history for the product page, shown for ALL products:
 * the Elume price (carried forward across gaps, so the line is continuous)
 * plus the AVG market price on days with competitor snapshots (mapped
 * products only). `currentPrice` guarantees at least one point.
 */
export async function fetchPriceHistory(productId: string, currentPrice?: number): Promise<MarketPoint[]> {
  const c = client();
  const ourByDay = new Map<string, number>();
  const marketByDay = new Map<string, number[]>();

  if (c) {
    const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString();
    try {
      const { data } = await c
        .from("price_history")
        .select("elume_price, captured_at")
        .eq("product_id", productId)
        .gte("captured_at", since)
        .order("captured_at", { ascending: true })
        .limit(1000);
      // Last write of the day wins (an admin edit after the morning snapshot).
      for (const r of (data ?? []) as { elume_price: number; captured_at: string }[]) {
        ourByDay.set(day(r.captured_at), Number(r.elume_price));
      }
    } catch { /* table may not exist yet */ }

    try {
      const { data } = await c
        .from("competitor_price_history")
        .select("comparable_price, captured_at")
        .eq("product_id", productId)
        .gt("comparable_price", 0)
        .gte("captured_at", since)
        .order("captured_at", { ascending: true })
        .limit(2000);
      for (const r of (data ?? []) as { comparable_price: number; captured_at: string }[]) {
        const d = day(r.captured_at);
        (marketByDay.get(d) ?? marketByDay.set(d, []).get(d)!).push(Number(r.comparable_price));
      }
    } catch { /* ignore */ }
  }

  if (ourByDay.size === 0 && currentPrice != null) ourByDay.set(day(new Date().toISOString()), currentPrice);

  const days = Array.from(new Set([...ourByDay.keys(), ...marketByDay.keys()])).sort();
  let lastOur: number | null = null;
  return days.map((d) => {
    if (ourByDay.has(d)) lastOur = ourByDay.get(d)!;
    const comps = marketByDay.get(d);
    return {
      at: d,
      our: lastOur,
      marketAvg: comps?.length ? Math.round(comps.reduce((s, v) => s + v, 0) / comps.length) : null,
    };
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
      .limit(500);
    if (error || !data) return [];
    return data.map((r: any) => ({ source: r.source, comparable: r.comparable_price, net: r.net_price, list: r.list_price, our: r.our_price, at: r.captured_at }));
  } catch {
    return [];
  }
}
