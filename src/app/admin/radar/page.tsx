import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listProductRows,
  listCompetitorSources,
  listCompetitorMap,
  listCompetitorPrices,
  lastCompetitorSync,
  listRepricingRules,
} from "@/lib/admin/data";
import { recommend, DEFAULT_RULE, type RepricingRule } from "@/lib/admin/repricing";
import RadarClient, { type RadarRow, type SourceInfo } from "@/app/admin/radar/RadarClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow "Sync now" to process many products in one request

function guessFactor(attrs: Record<string, string> | null): number {
  const m = attrs?.Length?.match(/(\d+)\s*m/);
  return m ? Number(m[1]) : 1;
}

export default async function RadarPage() {
  await requireAdmin();
  const [products, sources, maps, prices, sync, rulesRaw] = await Promise.all([
    listProductRows(),
    listCompetitorSources(),
    listCompetitorMap(),
    listCompetitorPrices(),
    lastCompetitorSync(),
    listRepricingRules(),
  ]);
  const rules: RepricingRule[] = rulesRaw.length ? rulesRaw : [DEFAULT_RULE];

  const srcList: SourceInfo[] = (sources.length ? sources : [{ id: "vashi", name: "Vashi", site_url: "https://vashiisl.com", enabled: true, needs_login: false, sort_order: 1 }]).map((s) => ({
    id: s.id, name: s.name, siteUrl: s.site_url, enabled: s.enabled, needsLogin: s.needs_login,
  }));

  const mapKey = (pid: string, src: string) => `${pid}::${src}`;
  const mapByKey = new Map(maps.map((m) => [mapKey(m.product_id, m.source), m]));
  const priceByKey = new Map(prices.map((p) => [mapKey(p.product_id, p.source), p]));

  const rows: RadarRow[] = products.map((p) => {
    const perSource = Object.fromEntries(
      srcList.map((s) => [s.id, { map: mapByKey.get(mapKey(p.id, s.id)) ?? null, price: priceByKey.get(mapKey(p.id, s.id)) ?? null }])
    );
    // Every mapped source that returned a price is a "seller"; the lowest wins.
    const priced = srcList
      .map((s) => {
        const cell = perSource[s.id];
        const v = cell.price?.comparable_price;
        return v != null && v > 0
          ? { source: s.name, sourceId: s.id, price: v, net: cell.price?.net_price ?? null, list: cell.price?.list_price ?? null, factor: cell.price?.unit_factor ?? cell.map?.unit_factor ?? 1, code: cell.map?.competitor_code ?? cell.price?.competitor_name ?? null, url: cell.price?.competitor_url ?? cell.map?.competitor_url ?? null }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    const mappedCount = srcList.filter((s) => perSource[s.id].map).length;
    const comparables = priced.map((x) => x.price);
    const cheapest = priced.length ? priced.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    const lowest = priced.length ? Math.min(...comparables) : null;
    const avgMarket = priced.length ? Math.round((comparables.reduce((a, b) => a + b, 0) / priced.length) * 100) / 100 : null;
    const target = lowest != null ? Math.max(1, Math.round(lowest) - 1) : null; // lowest − ₹1
    const pctVsLowest = lowest != null && lowest > 0 ? Math.round(((p.elume_price - lowest) / lowest) * 100) : null;
    const rec = comparables.length
      ? recommend({ ourPrice: p.elume_price, mrp: p.mrp, category: p.category, comparables }, rules)
      : null;
    return {
      id: p.id, name: p.name, brand: p.brand, category: p.category, unit: p.unit, image: p.image_url,
      ourPrice: p.elume_price, mrp: p.mrp, suggestedFactor: guessFactor(p.attrs), mappedCount,
      perSource,
      market: priced.length ? { sellers: priced, avgMarket: avgMarket!, lowest: lowest!, target: target!, pctVsLowest, cheapestSource: cheapest?.source ?? null } : null,
      rec: rec ? { basisPrice: rec.basisPrice, target: rec.target, changePct: Math.round(rec.changePct), blocked: rec.blocked, basis: rec.rule.basis, sellers: priced.length, cheapestSource: cheapest?.source ?? null } : null,
    };
  });

  const categories = Array.from(new Set(products.map((p) => p.category))).sort();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Competitor price radar</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 16px", maxWidth: 760 }}>
        Track competitor prices and get repricing recommendations you approve. Set your strategy and
        guardrails below; map each product once and the monthly sync keeps prices fresh.
      </p>

      <RadarClient rows={rows} sources={srcList} lastSync={sync} rules={rules} categories={categories} />
    </div>
  );
}
