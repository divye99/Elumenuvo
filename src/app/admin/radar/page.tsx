import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listProductRows,
  listCompetitorSources,
  listCompetitorMap,
  listCompetitorPrices,
  lastCompetitorSync,
} from "@/lib/admin/data";
import RadarClient, { type RadarRow, type SourceInfo } from "@/app/admin/radar/RadarClient";

export const dynamic = "force-dynamic";

function guessFactor(attrs: Record<string, string> | null): number {
  const m = attrs?.Length?.match(/(\d+)\s*m/);
  return m ? Number(m[1]) : 1;
}

export default async function RadarPage() {
  await requireAdmin();
  const [products, sources, maps, prices, sync] = await Promise.all([
    listProductRows(),
    listCompetitorSources(),
    listCompetitorMap(),
    listCompetitorPrices(),
    lastCompetitorSync(),
  ]);

  // Fallback source list if the sources table isn't seeded yet.
  const srcList: SourceInfo[] = (sources.length ? sources : [{ id: "vashi", name: "Vashi", site_url: "https://vashiisl.com", enabled: true, needs_login: true, sort_order: 1 }]).map((s) => ({
    id: s.id, name: s.name, siteUrl: s.site_url, enabled: s.enabled, needsLogin: s.needs_login,
  }));

  const mapKey = (pid: string, src: string) => `${pid}::${src}`;
  const mapByKey = new Map(maps.map((m) => [mapKey(m.product_id, m.source), m]));
  const priceByKey = new Map(prices.map((p) => [mapKey(p.product_id, p.source), p]));

  const rows: RadarRow[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    unit: p.unit,
    ourPrice: p.elume_price,
    suggestedFactor: guessFactor(p.attrs),
    perSource: Object.fromEntries(
      srcList.map((s) => [s.id, { map: mapByKey.get(mapKey(p.id, s.id)) ?? null, price: priceByKey.get(mapKey(p.id, s.id)) ?? null }])
    ),
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Competitor price radar</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 16px", maxWidth: 760 }}>
        Track competitor prices and get <b>₹1-under</b> suggestions you approve. Map each product to a
        competitor item once; the monthly sync refetches prices (their real logged-in price when a login
        is configured) and flags where you could adjust.
      </p>

      <RadarClient rows={rows} sources={srcList} lastSync={sync} />
    </div>
  );
}
