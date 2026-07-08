/**
 * BestOfElectricals (bestofelectricals.com) — a nopCommerce distributor store,
 * fully server-rendered. Carries most of our brands (Norisys, Havells, Legrand,
 * Anchor, Polycab, Finolex, Philips, Wipro, Usha, ABB, Schneider, KEI, RR Kabel,
 * Hager), each on a /<brand> manufacturer page.
 *   • search      → GET /search?q=… — product tiles carry data-productid, slug,
 *     name, old-price (MRP) and actual-price (selling).
 *   • fetchByCode → GET /<slug> — id=oldPrice (MRP), id=discountedPrice with
 *     itemprop=price content=NN.NN (selling).   (competitor_code = page slug)
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const BASE = "https://www.bestofelectricals.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const headers = { "User-Agent": UA, Accept: "text/html" };

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/(Rs\.?|₹|,|\s)/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse nopCommerce product tiles out of any listing/search page. */
export function parseTiles(html: string): CompetitorItem[] {
  const items: CompetitorItem[] = [];
  // Tiles: <div class=product-item data-productid=NNNN> … (attrs may be unquoted)
  const blocks = html.split(/<div class=["']?product-item["']? data-productid=/).slice(1);
  for (const b of blocks) {
    const chunk = b.slice(0, 4000);
    const title = chunk.match(/<h2 class=["']?product-title["']?>\s*<a href=["']?([^ >"']+)["']?[^>]*>([^<]+)<\/a>/);
    if (!title) continue;
    const old = num((chunk.match(/price old-price["']?>([^<]+)</) || [])[1]);
    const actual = num((chunk.match(/price actual-price["']?>([^<]+)</) || [])[1]);
    if (actual == null && old == null) continue;
    const img = (chunk.match(/data-lazyloadsrc=["']?([^ >"']+)/) || [])[1];
    const slug = title[1].replace(/^\//, "");
    items.push({
      code: slug,
      name: title[2].trim(),
      brand: title[2].trim().split(/\s+/)[0] || null, // tile names start with the brand
      listPrice: old ?? actual,
      netPrice: actual,
      url: `${BASE}/${slug}`,
      inStock: null,
    });
    void img; // image available if ever needed for the match picker
  }
  return items;
}

export const bestofelectricalsAdapter: CompetitorAdapter = {
  key: "bestofelectricals",
  name: "BestOfElectricals",
  siteUrl: BASE,
  needsLogin: false,

  async search(query, limit = 12) {
    const q = query.trim();
    if (!q) return [];
    try {
      const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}`, { headers, cache: "no-store" });
      if (!res.ok) return [];
      return parseTiles(await res.text()).slice(0, limit);
    } catch {
      return [];
    }
  },

  async fetchByCode(code) {
    const slug = code.trim().replace(/^\//, "");
    if (!slug) return null;
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();
      const name = (html.match(/<h1[^>]*itemprop=["']?name["']?[^>]*>([^<]+)/) || [])[1];
      const selling = num((html.match(/itemprop=["']?price["']? content=["']?([\d.]+)/) || [])[1]);
      const mrp = num((html.match(/id=["']?oldPrice["']?[^>]*>([^<]+)</) || [])[1]);
      if (selling == null && mrp == null) return null;
      return {
        code: slug,
        name: (name || "").trim(),
        brand: (name || "").trim().split(/\s+/)[0] || null,
        listPrice: mrp ?? selling,
        netPrice: selling,
        url: `${BASE}/${slug}`,
        inStock: !/out of stock/i.test(html),
      };
    } catch {
      return null;
    }
  },
};
