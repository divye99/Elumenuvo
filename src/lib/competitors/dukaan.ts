/**
 * Generic Dukaan (mydukaan.io) storefront adapter. Dukaan SSRs its data into a
 * `__DUKAAN_DATA__` JSON blob on every page — no login, no private API.
 *   • fetchByCode → GET /products/<slug> → DUKAAN_PRODUCT { selling_price,
 *     original_price (MRP), in_stock }   (competitor_code = product slug)
 *   • search      → best-effort filter over the homepage DUKAAN_CATALOG; mapping
 *     is otherwise by slug (copy it from the product URL). Live search is a
 *     private search-enterprise API we don't call.
 * Powers Syska today; any Dukaan store is a one-liner via makeDukaanAdapter.
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDukaan(html: string): Record<string, any> | null {
  const m = html.match(/id="__DUKAAN_DATA__">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function makeDukaanAdapter(cfg: { key: string; name: string; siteUrl: string }): CompetitorAdapter {
  const base = cfg.siteUrl.replace(/\/+$/, "");
  const headers = { "User-Agent": UA, Accept: "text/html" };

  const toItem = (p: Record<string, any>): CompetitorItem => {
    const net = num(p.selling_price);
    const list = num(p.original_price ?? p.compare_price ?? p.market_price);
    return {
      code: String(p.slug ?? ""),
      name: String(p.name ?? p.default_name ?? ""),
      brand: cfg.name,
      listPrice: list != null && net != null && list > net ? list : net,
      netPrice: net,
      url: p.slug ? `${base}/products/${p.slug}` : null,
      inStock: p.in_stock === false ? false : true,
    };
  };

  return {
    key: cfg.key,
    name: cfg.name,
    siteUrl: cfg.siteUrl,
    needsLogin: false,

    async search(query, limit = 12) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      try {
        const res = await fetch(`${base}/`, { headers, cache: "no-store" });
        if (!res.ok) return [];
        const data = parseDukaan(await res.text());
        if (!data) return [];
        // Collect every product object embedded on the homepage catalogue.
        const products: Record<string, any>[] = [];
        const walk = (o: any) => {
          if (Array.isArray(o)) o.forEach(walk);
          else if (o && typeof o === "object") {
            if (o.slug && o.selling_price != null && o.name) products.push(o);
            Object.values(o).forEach(walk);
          }
        };
        walk(data.DUKAAN_CATALOG ?? data);
        const seen = new Set<string>();
        return products
          .filter((p) => String(p.name).toLowerCase().includes(q))
          .filter((p) => (seen.has(p.slug) ? false : (seen.add(p.slug), true)))
          .slice(0, limit)
          .map(toItem);
      } catch {
        return [];
      }
    },

    async fetchByCode(code) {
      const slug = code.trim();
      if (!slug) return null;
      try {
        const res = await fetch(`${base}/products/${encodeURIComponent(slug)}`, { headers, cache: "no-store" });
        if (!res.ok) return null;
        const data = parseDukaan(await res.text());
        const p = data?.DUKAAN_PRODUCT;
        return p ? toItem(p) : null;
      } catch {
        return null;
      }
    },
  };
}
