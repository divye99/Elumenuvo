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
      .map((s) => ({ src: s.name, v: perSource[s.id].price?.comparable_price }))
      .filter((x): x is { src: string; v: number } => x.v != null && x.v > 0);
    const comparables = priced.map((x) => x.v);
    const cheapest = priced.length ? priced.reduce((a, b) => (b.v < a.v ? b : a)) : null;
    const rec = comparables.length
      ? recommend({ ourPrice: p.elume_price, mrp: p.mrp, category: p.category, comparables }, rules)
      : null;
    return {
      id: p.id, name: p.name, brand: p.brand, category: p.category, unit: p.unit,
      ourPrice: p.elume_price, mrp: p.mrp, suggestedFactor: guessFactor(p.attrs),
      perSource,
      rec: rec ? { basisPrice: rec.basisPrice, target: rec.target, changePct: Math.round(rec.changePct), blocked: rec.blocked, basis: rec.rule.basis, sellers: priced.length, cheapestSource: cheapest?.src ?? null } : null,
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
