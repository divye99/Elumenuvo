import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import {
  listProductRows,
  listCompetitorSources,
  listCompetitorMap,
  listCompetitorPrices,
} from "@/lib/admin/data";
import ProductManager, { type ManagerRow, type SourceInfo } from "@/app/admin/products/ProductManager";

export const dynamic = "force-dynamic";
// Bulk Excel imports and "apply all price suggestions" run as server actions on
// this page and can touch hundreds of rows; the default 10s budget killed them
// mid-flight and left the UI spinning.
export const maxDuration = 60;

function guessFactor(attrs: Record<string, string> | null): number {
  const m = attrs?.Length?.match(/(\d+)\s*m/);
  return m ? Number(m[1]) : 1;
}

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const [rows, sources, maps, prices] = await Promise.all([
    listProductRows(),
    listCompetitorSources(),
    listCompetitorMap(),
    listCompetitorPrices(),
  ]);
  const { ok, error } = await searchParams;

  const srcList: SourceInfo[] = (sources.length ? sources : [{ id: "vashi", name: "Vashi", site_url: "https://vashiisl.com", enabled: true, needs_login: false, sort_order: 1 }]).map((s) => ({
    id: s.id, name: s.name, siteUrl: s.site_url, enabled: s.enabled,
  }));

  const k = (pid: string, src: string) => `${pid}::${src}`;
  const mapByKey = new Map(maps.map((m) => [k(m.product_id, m.source), m]));
  const priceByKey = new Map(prices.map((p) => [k(p.product_id, p.source), p]));

  const managerRows: ManagerRow[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    brand_sku: r.brand_sku,
    brand: r.brand,
    category: r.category,
    spec: r.spec,
    unit: r.unit,
    mrp: r.mrp,
    elume_price: r.elume_price,
    is_active: r.is_active,
    is_recommended: r.is_recommended,
    parent_id: r.parent_id,
    attrs: r.attrs,
    sort_order: r.sort_order,
    image_url: r.image_url,
    suggestedFactor: guessFactor(r.attrs),
    perSource: Object.fromEntries(
      srcList.map((s) => [s.id, { map: mapByKey.get(k(r.id, s.id)) ?? null, price: priceByKey.get(k(r.id, s.id)) ?? null }])
    ),
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Products &amp; pricing</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/radar" style={{ background: "#fff", border: "1px solid #E0E4ED", color: "#19202e", fontWeight: 600, fontSize: 13.5, padding: "8px 15px", borderRadius: 10 }}>◎ All suggestions</Link>
          <Link href="/admin/products/new" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 10 }}>+ New product</Link>
        </div>
      </div>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px" }}>
        Expand any product to edit its details or see live competitor pricing and set your price ₹1 under.
      </p>

      {ok && <div style={{ background: "#E6F5EE", color: "#137a4b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>Saved{ok === "deleted" ? " — product deleted" : ""}.</div>}
      {error && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <ProductManager rows={managerRows} sources={srcList} />
    </div>
  );
}
