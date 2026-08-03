/**
 * Full selling-price history for a metals product - every capture, not the
 * one-point-per-day collapse fetchPriceHistory does. The copper rate changes
 * two to three times a day BY DESIGN, so the 24h chart needs each capture,
 * and the 5Y chart needs the whole series (price_history has public-read RLS;
 * rows come from every console save + the daily snapshot cron).
 */
import { createClient } from "@supabase/supabase-js";

export type RatePoint = { at: string; price: number };

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchFullPriceHistory(productId: string, currentPrice?: number): Promise<RatePoint[]> {
  const c = client();
  const out: RatePoint[] = [];
  if (c) {
    try {
      // Page past PostgREST's 1000-row cap: ~3 captures/day is ~5.5k rows
      // over five years. Ascending order keeps the pages stitchable.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await c
          .from("price_history")
          .select("elume_price, captured_at")
          .eq("product_id", productId)
          .order("captured_at", { ascending: true })
          .range(from, from + 999);
        if (error || !data?.length) break;
        for (const r of data as { elume_price: number; captured_at: string }[]) {
          out.push({ at: r.captured_at, price: Number(r.elume_price) });
        }
        if (data.length < 1000) break;
      }
    } catch { /* table may not exist yet */ }
  }
  // Always end the series at the live price so the chart never contradicts
  // the buy box (the latest console save may still be inside the ISR window).
  if (currentPrice != null && (out.length === 0 || out[out.length - 1].price !== currentPrice)) {
    out.push({ at: new Date().toISOString(), price: currentPrice });
  }
  return out;
}
