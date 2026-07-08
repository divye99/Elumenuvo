/**
 * HandyPanda (handypanda.in) — a Next.js App-Router marketplace on Vercel. Its
 * homepage renders prices client-side, but category and product PAGES server-
 * render them into the RSC payload, so we scrape those.
 *   • fetchByCode → GET /products/<slug> → og:title (name) + the embedded
 *     "price" (selling)   (competitor_code = product slug)
 *   • search      → the electricals category page lists /products/<slug> links;
 *     we derive display names from the slug and filter. Prices come on
 *     fetchByCode (mapping is by slug).
 * Multi-brand marketplace → brand is left null (varies per listing).
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const BASE = "https://www.handypanda.in";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const headers = { "User-Agent": UA, Accept: "text/html" };

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// "anchor-switch-9ahqgeh" → "Anchor Switch" (drop the trailing random id token).
function nameFromSlug(slug: string): string {
  const parts = slug.split("-");
  const last = parts[parts.length - 1];
  if (parts.length > 1 && /[a-z]/.test(last) && /[0-9]/.test(last)) parts.pop(); // random suffix
  return parts.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// og:title is "<Product> — <Brand> | HandyPanda" — trim the site suffix.
function cleanName(raw: string | undefined): string {
  return (raw ?? "").replace(/\s*\|\s*HandyPanda\s*$/i, "").trim();
}

export const handypandaAdapter: CompetitorAdapter = {
  key: "handypanda",
  name: "HandyPanda",
  siteUrl: BASE,
  needsLogin: false,

  async search(query, limit = 12) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    try {
      const res = await fetch(`${BASE}/categories/electricals`, { headers, cache: "no-store" });
      if (!res.ok) return [];
      const html = await res.text();
      const slugs = [...new Set([...html.matchAll(/\/products\/([a-z0-9-]+)/g)].map((m) => m[1]))];
      return slugs
        .map((slug) => ({ slug, name: nameFromSlug(slug) }))
        .filter((p) => p.name.toLowerCase().includes(q))
        .slice(0, limit)
        .map<CompetitorItem>((p) => ({
          code: p.slug, name: p.name, brand: null,
          listPrice: null, netPrice: null, url: `${BASE}/products/${p.slug}`, inStock: null,
        }));
    } catch {
      return [];
    }
  },

  async fetchByCode(code) {
    const slug = code.trim();
    if (!slug) return null;
    try {
      const res = await fetch(`${BASE}/products/${encodeURIComponent(slug)}`, { headers, cache: "no-store" });
      if (!res.ok) return null;
      const html = await res.text();
      const name = cleanName((html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/) || [])[1]);
      const price = num((html.match(/\\?"price\\?":\s*\\?"?(\d{2,7})/) || [])[1]);
      if (price == null) return null;
      const mrp = num((html.match(/\\?"(?:mrp|maxRetailPrice|listPrice|comparePrice)\\?":\s*\\?"?(\d{2,7})/) || [])[1]);
      return {
        code: slug, name: name || nameFromSlug(slug), brand: null,
        listPrice: mrp != null && mrp > price ? mrp : price, netPrice: price,
        url: `${BASE}/products/${slug}`, inStock: true,
      };
    } catch {
      return null;
    }
  },
};
