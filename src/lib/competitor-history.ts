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
