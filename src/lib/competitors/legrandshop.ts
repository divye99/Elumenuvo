/**
 * Legrand e-shop adapter (shop.legrand.co.in) — HTML scraping, not GraphQL.
 *
 * The store runs Magento like Havells, but its GraphQL layer does not expose
 * the catalogue: sku filters return nothing and full-text search misses most
 * products, so the Havells adapter pattern cannot work here. What IS reliable
 * is the product page itself, whose slug URLs are stable and which prints the
 * SKU, the selling price and the MRP.
 *
 *   • competitor_code = the page SLUG ("mylinc-6a-switch-sp-1-way-...").
 *     Codes are seeded by the one-time catalogue crawl at import time
 *     (861 SKU→slug pairs), the same way the Havells index seeded 0066.
 *   • fetchByCode fetches the page and — because a slug could in principle be
 *     recycled — verifies the on-page SKU when the mapping's expected SKU is
 *     appended as "slug#SKU". A mismatch returns null rather than a wrong price.
 *   • Pricing rule matches Havells: first price on the page is the selling
 *     price, the struck-through second one is the MRP.
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const BASE = "https://shop.legrand.co.in";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

function parsePdp(html: string, slug: string): CompetitorItem | null {
  const name = (html.match(/"name":"([^"]{4,120})"/) || [])[1];
  const sku = (html.match(/\bSKU\b[^0-9A-Z]{0,40}([0-9A-Z][0-9A-Z ]{4,12})/) || [])[1]?.replace(/\s+/g, "");
  const prices = [...html.matchAll(/<span class="price">\s*₹\s*([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (!name || !prices.length) return null;
  const sell = prices[0];
  const mrp = prices.length > 1 ? Math.max(prices[0], prices[1]) : prices[0];
  return {
    code: slug,
    name,
    brand: "Legrand",
    listPrice: mrp,
    netPrice: sell,
    url: `${BASE}/${slug}`,
    inStock: !/out of stock/i.test(html),
    ...(sku ? { resolvedCode: undefined } : {}),
  };
}

export const legrandShopAdapter: CompetitorAdapter = {
  key: "legrand",
  name: "Legrand",
  siteUrl: BASE,
  needsLogin: false,

  async search(query, limit = 10) {
    try {
      const res = await fetch(`${BASE}/catalogsearch/result/?q=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (!res.ok) return [];
      const html = await res.text();
      const links = [...html.matchAll(/class="product-item-link"[^>]*href="https:\/\/shop\.legrand\.co\.in\/([a-z0-9-]+)"\s*>\s*([^<]{4,90})/g)];
      // Listing pages carry name+link only; price comes from fetchByCode.
      return links.slice(0, limit).map((m) => ({
        code: m[1],
        name: m[2].trim(),
        brand: "Legrand",
        listPrice: null,
        netPrice: null,
        url: `${BASE}/${m[1]}`,
        inStock: null,
      }));
    } catch {
      return [];
    }
  },

  async fetchByCode(code) {
    // "slug#EXPECTEDSKU" — the fragment pins the mapping to a SKU so a
    // repurposed slug can never feed us another product's price.
    const [slug, expectSku] = code.trim().split("#");
    if (!slug) return null;
    try {
      const res = await fetch(`${BASE}/${slug}`, { headers: { "User-Agent": UA }, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();
      if (expectSku) {
        const onPage = (html.match(/\bSKU\b[^0-9A-Z]{0,40}([0-9A-Z][0-9A-Z ]{4,12})/) || [])[1]?.replace(/\s+/g, "");
        if (onPage && onPage !== expectSku) return null; // slug now shows a different product
      }
      const item = parsePdp(html, code.trim());
      return item;
    } catch {
      return null;
    }
  },
};
