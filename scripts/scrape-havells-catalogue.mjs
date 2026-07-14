#!/usr/bin/env node
/**
 * Scrape the full Havells ELECTRICAL catalogue from havells.com.
 *
 * Scope (user decision, Jul 2026): Fans, Lighting, Switches & Accessories,
 * Home Electricals, Green Energy. Consumer appliances (ACs, TVs, fridges,
 * kitchen, grooming) are deliberately excluded: Elume is a B2B FMEG catalogue.
 *
 * Two phases:
 *   1. Magento GraphQL: enumerate every product under the 5 root categories
 *      with prices (final = selling, regular = MRP), stock, images, category
 *      memberships and per-COLOUR variant SKUs (each colour is its own SKU,
 *      e.g. WHFFDNKL12X57 = Black Lifeline FR 2.5 sqmm 180 m).
 *   2. PDP HTML: Key Features bullets, feature cards, the Technical
 *      Specifications table (data-label / data-value rows) and Net Quantity.
 *      These exist ONLY in the page HTML, not in GraphQL.
 *
 * Everything is scraped INCLUDING out-of-stock items: the import step skips
 * OOS, but the cross-check/removal step needs the full "exists on the site"
 * list so a temporarily-OOS product is not wrongly deleted from Elume.
 *
 * Output: scripts/data/havells-catalogue.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "havells-catalogue.json");
const BASE = "https://havells.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Root category ids on havells.com (verified live). Anchor categories include
// every descendant, so querying the roots covers the whole subtree.
const ROOTS = [
  { id: "50", name: "Fans" },
  { id: "116", name: "Lighting" },
  { id: "83", name: "Switches & Accessories" },
  { id: "278", name: "Home Electricals" },
  { id: "3814", name: "Green Energy" },
];

const PRODUCT_FIELDS = `
  sku name url_key stock_status attribute_set_id meta_description
  description { html } short_description { html }
  media_gallery { url label position disabled }
  price_range { minimum_price { regular_price { value } final_price { value } } }
  categories { id name url_path }
  ... on ConfigurableProduct {
    configurable_options { attribute_code label values { value_index label } }
    variants {
      product {
        sku name stock_status
        media_gallery { url label }
        price_range { minimum_price { regular_price { value } final_price { value } } }
      }
      attributes { code label value_index }
    }
  }`;

async function gql(query, attempt = 1) {
  try {
    const r = await fetch(`${BASE}/graphql?query=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    const text = await r.text();
    const j = JSON.parse(text); // throws on the HTML block page
    if (j.errors) throw new Error(j.errors.map((e) => e.message).join("; "));
    return j.data;
  } catch (e) {
    if (attempt >= 4) throw e;
    await sleep(1500 * attempt);
    return gql(query, attempt + 1);
  }
}

async function enumerateRoot(root) {
  const out = [];
  let page = 1, total = Infinity;
  while ((page - 1) * 50 < total) {
    const q = `query{products(filter:{category_id:{eq:"${root.id}"}},pageSize:50,currentPage:${page}){total_count items{${PRODUCT_FIELDS}}}}`;
    const data = await gql(q);
    total = data.products.total_count;
    out.push(...data.products.items);
    console.log(`  ${root.name}: page ${page}, ${out.length}/${total}`);
    page++;
    await sleep(300);
  }
  return out;
}

/* ── PDP HTML parsing ── */
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();

function parsePdp(html) {
  const out = { keyFeatures: [], featureCards: [], techSpecs: {}, netQuantity: null };

  // Key Features: <div id="customShortDescription"> ... <ul><li>...</li></ul>
  const ksIdx = html.indexOf('id="customShortDescription"');
  if (ksIdx >= 0) {
    const block = html.slice(ksIdx, ksIdx + 8000);
    const ul = block.match(/<ul>([\s\S]*?)<\/ul>/);
    if (ul) for (const li of ul[1].matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      const t = strip(li[1]);
      if (t) out.keyFeatures.push(t);
    }
  }

  // Feature cards: <div class="col-md-6 mb-5"><h3>Title</h3><p>Body</p></div>
  for (const m of html.matchAll(/<div class="col-md-6 mb-5">\s*<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)) {
    const title = strip(m[1]), body = strip(m[2]);
    if (title) out.featureCards.push({ title, body });
  }

  // Technical Specifications: specs-row with data-label / data-value. The
  // closing divs may have whitespace/newlines between them (the last row of
  // every page does), so the terminator must allow it; a strict </div></div>
  // made the last row's lazy match swallow the rest of the document.
  for (const m of html.matchAll(/<div class='specs-row[^']*'>\s*<div class='data-label'>([\s\S]*?)<\/div>\s*<div class='data-value'>([\s\S]*?)<\/div>\s*<\/div>/g)) {
    const k = strip(m[1]), v = strip(m[2]);
    // Defense in depth: a real spec value is short. Anything longer means the
    // match ran past the section; drop it rather than store page soup.
    if (k && v && k.length <= 80 && v.length <= 400) out.techSpecs[k] = v;
  }

  const nq = html.match(/Net Quantity\s*:?\s*<\/span><span[^>]*>\s*([^<]{1,40})</);
  if (nq) out.netQuantity = strip(nq[1]);

  return out;
}

async function fetchPdp(urlKey, attempt = 1) {
  try {
    const r = await fetch(`${BASE}/${urlKey}.html`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return parsePdp(await r.text());
  } catch (e) {
    if (attempt >= 3) return { error: String(e.message || e) };
    await sleep(2000 * attempt);
    return fetchPdp(urlKey, attempt + 1);
  }
}

async function main() {
  console.log("Phase 1: GraphQL enumeration");
  const bySku = new Map();
  for (const root of ROOTS) {
    const items = await enumerateRoot(root);
    for (const it of items) {
      const prev = bySku.get(it.sku);
      if (prev) {
        const seen = new Set(prev.categories.map((c) => c.id));
        for (const c of it.categories ?? []) if (!seen.has(c.id)) prev.categories.push(c);
        prev._roots.push(root.name);
      } else {
        bySku.set(it.sku, { ...it, categories: it.categories ?? [], _roots: [root.name] });
      }
    }
  }
  console.log(`Distinct products: ${bySku.size}`);

  console.log("Phase 2: PDP details");
  const products = [...bySku.values()];
  let done = 0;
  const CONC = 5;
  const queue = [...products];
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) {
      const p = queue.shift();
      if (!p) return;
      p.pdp = await fetchPdp(p.url_key);
      done++;
      if (done % 50 === 0) console.log(`  PDP ${done}/${products.length}`);
      await sleep(150);
    }
  }));
  const failed = products.filter((p) => p.pdp?.error);
  console.log(`PDP done. Failures: ${failed.length}`);
  for (const f of failed.slice(0, 20)) console.log(`  FAIL ${f.url_key}: ${f.pdp.error}`);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify({ scrapedAt: new Date().toISOString(), source: BASE, roots: ROOTS.map((r) => r.name), count: products.length, products }, null, 1));
  console.log(`Wrote ${OUT}`);

  // Summary for the log
  const inStock = products.filter((p) => p.stock_status === "IN_STOCK").length;
  const withVariants = products.filter((p) => (p.variants ?? []).length > 0).length;
  const priced = products.filter((p) => (p.price_range?.minimum_price?.final_price?.value ?? 0) > 0).length;
  console.log(`Summary: ${products.length} products, ${inStock} in stock, ${withVariants} with colour variants, ${priced} with a non-zero price.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
