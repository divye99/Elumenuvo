/**
 * Shared competitor fetchers for the Node scripts (monthly sync + one-off
 * backfills). Each fetcher: fetchByCode(code) → { code, name, listPrice,
 * netPrice, url, inStock } | null. listPrice = the non-discounted / MRP price on
 * the source; netPrice = the live selling price. Mirrors src/lib/competitors/.
 * All feeds are public (no login).
 */
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const PINCODE = (process.env.VASHI_PINCODE || "400001").trim();

export const num = (v) => {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
};

async function vashiFetch(code) {
  const OCC = "https://prodapi.vashiisl.com/occ/v2/visl";
  const HDRS = { "User-Agent": UA, Accept: "application/json", "X-Custom-Country": "IN", "X-Custom-Pincode": PINCODE, "X-Custom-Dealer": "" };
  try {
    const r = await fetch(`${OCC}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`, { headers: HDRS });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.code) return null;
    const price = d.price ?? {};
    const list = num(price.mrp ?? price.mrpValue);
    const value = num(price.value ?? price.sellingPrice);
    const net = value != null && list != null && value < list ? value : null;
    const rel = typeof d.url === "string" ? d.url : null;
    return { code: String(d.code), name: String(d.name ?? ""), listPrice: list ?? value, netPrice: net, url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null, inStock: d.stock?.stockLevelStatus ? d.stock.stockLevelStatus !== "outOfStock" : null };
  } catch { return null; }
}

function shopifyFetch(base) {
  const b = base.replace(/\/+$/, "");
  return async (handle) => {
    try {
      const r = await fetch(`${b}/products/${encodeURIComponent(handle)}.json`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) return null;
      const p = (await r.json())?.product;
      if (!p) return null;
      const variants = p.variants ?? [];
      const v = variants[0] ?? {};
      const selling = num(v.price);
      const mrp = num(v.compare_at_price); // "0.00" when no MRP set → treat as absent
      return { code: String(p.handle ?? handle), name: String(p.title ?? ""), listPrice: mrp && mrp > 0 ? mrp : selling, netPrice: selling, url: `${b}/products/${p.handle ?? handle}`, inStock: variants.length ? variants.some((x) => x.available !== false) : null };
    } catch { return null; }
  };
}

function magentoFetch(base) {
  const b = base.replace(/\/+$/, "");
  const FIELDS = "items{sku name url_key canonical_url stock_status price_range{minimum_price{regular_price{value} final_price{value}}}}";
  // Magento pages are /<url_key>.html — the bare url_key 404s. Prefer canonical_url.
  const purl = (it) => (it.canonical_url ? `${b}/${String(it.canonical_url).replace(/^\/+/, "")}` : it.url_key ? `${b}/${it.url_key}.html` : null);
  return async (sku) => {
    try {
      const q = `query{products(filter:{sku:{eq:${JSON.stringify(sku)}}}){${FIELDS}}}`;
      const r = await fetch(`${b}/graphql?query=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json", Store: "default" } });
      if (!r.ok) return null;
      const it = (await r.json())?.data?.products?.items?.[0];
      if (!it) return null;
      const mp = it.price_range?.minimum_price ?? {};
      const regular = num(mp.regular_price?.value);
      const final = num(mp.final_price?.value);
      return { code: String(it.sku ?? sku), name: String(it.name ?? ""), listPrice: regular ?? final, netPrice: final, url: purl(it), inStock: it.stock_status ? it.stock_status === "IN_STOCK" : null };
    } catch { return null; }
  };
}

function dukaanFetch(base) {
  const b = base.replace(/\/+$/, "");
  return async (slug) => {
    try {
      const r = await fetch(`${b}/products/${encodeURIComponent(slug)}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (!r.ok) return null;
      const html = await r.text();
      const m = html.match(/id="__DUKAAN_DATA__">([\s\S]*?)<\/script>/);
      if (!m) return null;
      const p = JSON.parse(m[1]).DUKAAN_PRODUCT;
      if (!p) return null;
      const net = num(p.selling_price), list = num(p.original_price);
      return { code: String(p.slug ?? slug), name: String(p.name ?? ""), listPrice: list && net && list > net ? list : net, netPrice: net, url: `${b}/products/${p.slug ?? slug}`, inStock: p.in_stock !== false };
    } catch { return null; }
  };
}

async function handypandaFetch(slug) {
  try {
    const r = await fetch(`https://www.handypanda.in/products/${encodeURIComponent(slug)}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return null;
    const html = await r.text();
    const name = ((html.match(/<meta property="og:title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/) || [])[1] || "").replace(/\s*\|\s*HandyPanda\s*$/i, "").trim();
    const price = num((html.match(/\\?"price\\?":\s*\\?"?(\d{2,7})/) || [])[1]);
    if (price == null) return null;
    const mrp = num((html.match(/\\?"(?:mrp|maxRetailPrice|listPrice)\\?":\s*\\?"?(\d{2,7})/) || [])[1]);
    return { code: slug, name, listPrice: mrp && mrp > price ? mrp : price, netPrice: price, url: `https://www.handypanda.in/products/${slug}`, inStock: true };
  } catch { return null; }
}

async function boeFetch(slug) {
  try {
    const r = await fetch(`https://www.bestofelectricals.com/${encodeURIComponent(slug.replace(/^\//, ""))}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return null;
    const html = await r.text();
    const name = ((html.match(/<h1[^>]*itemprop=["']?name["']?[^>]*>([^<]+)/) || [])[1] || "").trim();
    const selling = num((html.match(/itemprop=["']?price["']? content=["']?([\d.]+)/) || [])[1]);
    const mrp = num(((html.match(/id=["']?oldPrice["']?[^>]*>([^<]+)</) || [])[1] || "").replace(/Rs\.?/i, ""));
    if (selling == null && mrp == null) return null;
    return { code: slug, name, listPrice: mrp ?? selling, netPrice: selling, url: `https://www.bestofelectricals.com/${slug}`, inStock: !/out of stock/i.test(html) };
  } catch { return null; }
}

// Source id → fetcher. Must match the DB source ids + src/lib/competitors.
export const FETCHERS = {
  vashi: vashiFetch,
  crompton: shopifyFetch("https://www.crompton.co.in"),
  orient: shopifyFetch("https://orientelectric.com"),
  legrand: magentoFetch("https://shop.legrand.co.in"),
  havells: magentoFetch("https://havells.com"),
  atomberg: magentoFetch("https://atomberg.com"),
  syska: dukaanFetch("https://syska.co.in"),
  handypanda: handypandaFetch,
  bestofelectricals: boeFetch,
};

// Manufacturer-owned storefronts → their non-discounted price IS the true MRP.
// (Marketplaces/distributors — vashi, handypanda, bestofelectricals — are less
// authoritative, though BOE prints an explicit MRP field.)
export const BRAND_DIRECT = new Set(["crompton", "orient", "havells", "legrand", "syska", "atomberg"]);
