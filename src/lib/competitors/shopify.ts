/**
 * Generic Shopify storefront adapter (no auth, public JSON).
 *   • search      → /search/suggest.json?q=…&resources[type]=product
 *   • fetchByCode → /products/<handle>.json   (competitor_code = product handle,
 *     or "handle::variantId" for one specific variant's price - the form the
 *     Orient/Crompton imports store in brand_sku for per-variant auto-mapping)
 *   • fetchBatch  → groups composite codes by handle, so one product fetch
 *     serves every mapped variant of that product.
 * Shopify prices are in the store currency's major units (₹), one selling price
 * per variant; `compare_at_price` is the MRP/list. Powers Crompton + Orient; any
 * Shopify DTC brand is a one-liner via makeShopifyAdapter({ key, name, siteUrl }).
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Shopify sends compare_at_price as "0.00" when no MRP is set - treat as absent.
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
      const [handle, variantKey] = code.trim().split("::").map((x) => x.trim());
      if (!handle) return null;
      try {
        const p = await fetchProduct(handle);
        return p ? itemFor(p, variantKey, code.trim()) : null;
      } catch {
        return null;
      }
    },

    /** Composite "handle::variantId" codes group by handle - one product fetch
     *  serves every mapped variant (an Orient fan can have 6+ colours mapped). */
    async fetchBatch(codes) {
      const out = new Map<string, CompetitorItem>();
      const byHandle = new Map<string, string[]>();
      for (const raw of codes) {
        const code = raw.trim();
        if (!code) continue;
        const [handle] = code.split("::");
        byHandle.set(handle, [...(byHandle.get(handle) ?? []), code]);
      }
      for (const [handle, group] of byHandle) {
        try {
          const p = await fetchProduct(handle);
          if (!p) continue;
          for (const code of group) {
            const item = itemFor(p, code.includes("::") ? code.split("::")[1] : undefined, code);
            if (item) out.set(code, item);
          }
        } catch { /* the per-code path can still retry these */ }
      }
      return out;
    },
  };

  /** Prefer /products/<handle>.js: unlike the .json endpoint its variants carry
   *  `available` (real stock state) - but its prices are in MINOR units (paise),
   *  flagged via __minorUnits for itemFor. The .json endpoint is the fallback
   *  (rupee prices, no availability). */
  async function fetchProduct(handle: string): Promise<Record<string, any> | null> {
    try {
      const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.js`, { headers: headers(), cache: "no-store" });
      if (res.ok) {
        const p = (await res.json()) as any;
        if (p?.variants?.length) return { ...p, __minorUnits: true };
      }
    } catch { /* fall through to .json */ }
    const res = await fetch(`${base}/products/${encodeURIComponent(handle)}.json`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as any)?.product ?? null;
  }

  /** Build the item for one variant (matched by id or sku) or, with no variant
   *  key, the product's first variant - the pre-variant behaviour, kept for
   *  every plain-handle mapping already stored. */
  function itemFor(p: Record<string, any>, variantKey: string | undefined, code: string): CompetitorItem | null {
    const variants: Record<string, any>[] = p.variants ?? [];
    const v = variantKey
      ? variants.find((x) => String(x.id) === variantKey || (x.sku && String(x.sku) === variantKey))
      : variants[0];
    if (!v) return null;
    const scale = p.__minorUnits ? 100 : 1;
    const div = (n: number | null): number | null => (n == null ? null : Math.round((n / scale) * 100) / 100);
    const selling = div(num(v.price));
    const mrp = pos(div(num(v.compare_at_price)));
    const optSuffix = [v.title].filter((t) => t && t !== "Default Title").join("");
    return {
      code,
      name: optSuffix ? `${p.title} - ${optSuffix}` : String(p.title ?? ""),
      brand: (p.vendor as string) ?? cfg.name,
      listPrice: mrp ?? selling,
      netPrice: selling,
      url: `${base}/products/${p.handle}`,
      inStock: variantKey
        ? (typeof v.available === "boolean" ? v.available : null)
        : (variants.some((x) => typeof x.available === "boolean") ? variants.some((x) => x.available === true) : null),
    };
  }
}
