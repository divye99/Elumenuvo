import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listProductRows, listCompetitorMap, listCompetitorPrices, lastCompetitorSync } from "@/lib/admin/data";
import RadarClient, { type RadarRow } from "@/app/admin/radar/RadarClient";

export const dynamic = "force-dynamic";

/** Guess the per-metre → our-unit factor from a wire's Length attr (Vashi
 *  prices wire per metre; our coils are 90 m etc.). 1 for non-length products. */
function guessFactor(attrs: Record<string, string> | null): number {
  const len = attrs?.Length;
  const m = len?.match(/(\d+)\s*m/);
  return m ? Number(m[1]) : 1;
}

export default async function RadarPage() {
  await requireAdmin();
  const [products, maps, prices, sync] = await Promise.all([
    listProductRows(),
    listCompetitorMap(),
    listCompetitorPrices(),
    lastCompetitorSync(),
  ]);

  const mapById = new Map(maps.map((m) => [m.product_id, m]));
  const priceById = new Map(prices.map((p) => [p.product_id, p]));

  const rows: RadarRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    unit: p.unit,
    ourPrice: p.elume_price,
    suggestedFactor: guessFactor(p.attrs),
    map: mapById.get(p.id) ?? null,
    price: priceById.get(p.id) ?? null,
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Competitor price radar</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 720 }}>
        Tracks <b>vashiisl.com</b> prices monthly. Map each product to a Vashi item once (with a unit
        factor — Vashi prices wire per metre, so a 90 m coil uses ×90). Each month we refetch those prices and
        suggest setting your Elume price to <b>₹1 under</b> theirs — you approve each one.
      </p>

      <RadarClient rows={rows} lastSync={sync} />
    </div>
  );
}
