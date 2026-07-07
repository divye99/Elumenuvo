/**
 * Generic Shopify storefront adapter (no auth, public JSON).
 *   • search      → /search/suggest.json?q=…&resources[type]=product
 *   • fetchByCode → /products/<handle>.json   (competitor_code = product handle)
 * Shopify prices are in the store currency's major units (₹), one selling price
 * per variant; `compare_at_price` is the MRP/list. Powers Crompton today; any
 * Shopify DTC brand is a one-liner via makeShopifyAdapter({ key, name, siteUrl }).
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Shopify sends compare_at_price as "0.00" when no MRP is set — treat as absent.
const pos = (n: number | null): number | null => (n != null && n > 0 ? n : null);

function headers(): Record<string, string> {
  return { "User-Agent": UA, Accept: "application/json" };
}

export function makeShopifyAdapter(cfg: { key: string; name: string; siteUrl: string }): CompetitorAdapter {
  const base = cfg.siteUrl.replace(/\/+$/, "");

  // A product from the search-suggest payload (compact shape).
  const fromSuggest = (p: Record<string, any>): CompetitorItem => {
    const selling = num(p.price);
    const mrp = pos(num(p.compare_at_price_max ?? p.compare_at_price));
    const url = typeof p.url === "string" ? p.url : null;
    return {
      code: String(p.handle ?? ""),
      name: String(p.title ?? ""),
      brand: (p.vendor as string) ?? cfg.name,
      listPrice: mrp ?? selling,
      netPrice: selling, // the live DTC selling price (our "net")
      url: url ? (url.startsWith("http") ? url : `${base}${url}`) : null,
      inStock: typeof p.available === "boolean" ? p.available : null,
    };
  };

  return {
    key: cfg.key,
    name: cfg.name,
    siteUrl: cfg.siteUrl,
    needsLogin: false,

    async search(query, limit = 12) {
      const q = query.trim();
      if (!q) return [];
      try {
        const url = `${base}/search/suggest.json?q=${encodeURIComponent(q)}&resources%5Btype%5D=product&resources%5Blimit%5D=${limit}`;
        const res = await fetch(url, { headers: headers(), cache: "no-store" });
        if (!res.ok) return [];
        const data = (await res.json()) as any;
        const products: Record<string, any>[] = data?.resources?.results?.products ?? [];
        return products.map(fromSuggest).filter((p) => p.code);
      } catch {
        return [];
      }
    },

    async fetchByCode(code) {
      const handle = code.trim();
      if (!handle) return null;
      try {
        const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.json`, { headers: headers(), cache: "no-store" });
        if (!res.ok) return null;
        const p = ((await res.json()) as any)?.product;
        if (!p) return null;
        const variants: Record<string, any>[] = p.variants ?? [];
        const v = variants[0] ?? {};
        const selling = num(v.price);
        const mrp = pos(num(v.compare_at_price));
        return {
          code: String(p.handle ?? handle),
          name: String(p.title ?? ""),
          brand: (p.vendor as string) ?? cfg.name,
          listPrice: mrp ?? selling,
          netPrice: selling,
          url: `${base}/products/${p.handle ?? handle}`,
          inStock: variants.length ? variants.some((x) => x.available !== false) : null,
        };
      } catch {
        return null;
      }
    },
  };
}
