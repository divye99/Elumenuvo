/**
 * Competitor sync core — refetch every mapped Vashi code's live price, compute
 * the ₹1-under suggestion, and upsert competitor_prices. Used by both the admin
 * "Sync now" action and the monthly GitHub Action (which reimplements the same
 * loop in plain JS). Takes any Supabase client so it works with the service-role
 * client server-side.
 */
import { fetchVashiProduct, computeSuggestion } from "@/lib/admin/vashi";

type SupaLike = {
  from: (t: string) => any;
};

export type SyncResult = { mapped: number; fetched: number; failed: number; suggestions: number };

export async function runCompetitorSync(db: SupaLike, source: "cron" | "manual"): Promise<SyncResult> {
  const { data: maps } = await db.from("competitor_map").select("product_id, vashi_code, unit_factor");
  const { data: products } = await db.from("products").select("id, elume_price");
  const { data: prev } = await db.from("competitor_prices").select("product_id, vashi_price, status");

  const priceById = new Map<string, number>((products ?? []).map((p: any) => [p.id, Number(p.elume_price)]));
  const prevById = new Map<string, { vashi_price: number | null; status: string }>(
    (prev ?? []).map((r: any) => [r.product_id, { vashi_price: r.vashi_price, status: r.status }])
  );

  let fetched = 0, failed = 0, suggestions = 0;
  const rows = maps ?? [];

  for (const m of rows) {
    const vp = await fetchVashiProduct(m.vashi_code);
    if (!vp || vp.price == null) { failed++; continue; }
    fetched++;

    const factor = Number(m.unit_factor) || 1;
    const { comparable, suggested } = computeSuggestion(vp.price, factor);
    const ourPrice = priceById.get(m.product_id) ?? null;

    // Preserve a prior accept/dismiss decision while the Vashi price is unchanged;
    // reset to "pending" when their price moved (a fresh call to action).
    const before = prevById.get(m.product_id);
    const priceUnchanged = before && before.vashi_price != null && Math.abs(Number(before.vashi_price) - vp.price) < 0.005;
    let status = "pending";
    if (priceUnchanged && (before!.status === "accepted" || before!.status === "dismissed")) status = before!.status;

    // A row is only an actionable suggestion when it's pending AND our price
    // differs from the ₹1-under target.
    const actionable = status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested;
    if (actionable) suggestions++;

    await db.from("competitor_prices").upsert({
      product_id: m.product_id,
      vashi_code: vp.code,
      vashi_name: vp.name,
      vashi_url: vp.url,
      vashi_price: vp.price,
      unit_factor: factor,
      comparable_price: comparable,
      suggested_price: suggested,
      our_price: ourPrice,
      status,
      in_stock: vp.inStock,
      fetched_at: new Date().toISOString(),
    });

    // Gentle pacing — we only run monthly, no need to hammer their API.
    await new Promise((r) => setTimeout(r, 250));
  }

  await db.from("competitor_sync_log").insert({
    mapped: rows.length,
    fetched,
    failed,
    suggestions,
    source,
  });

  return { mapped: rows.length, fetched, failed, suggestions };
}
