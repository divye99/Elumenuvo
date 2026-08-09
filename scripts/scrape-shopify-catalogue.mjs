#!/usr/bin/env node
/**
 * Generic Shopify catalogue scraper over the public /products.json feed.
 *   node scripts/scrape-shopify-catalogue.mjs <base-url> <out-name>
 * e.g. node scripts/scrape-shopify-catalogue.mjs https://orientelectric.com orient
 * Paginates 250 at a time until an empty page; saves scripts/data/<out>-catalogue.json.
 * The feed carries everything an import needs: title, handle, body_html,
 * product_type, tags, variants (sku, price, compare_at_price, available,
 * option values) and images - no second pass required.
 */
import { writeFile, mkdir } from "node:fs/promises";

const [base, out] = process.argv.slice(2);
if (!base || !out) { console.error("usage: scrape-shopify-catalogue.mjs <base-url> <name>"); process.exit(1); }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36";

const all = [];
for (let page = 1; ; page++) {
  const res = await fetch(`${base.replace(/\/+$/, "")}/products.json?limit=250&page=${page}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) { console.error(`page ${page}: HTTP ${res.status}`); break; }
  const { products } = await res.json();
  if (!products?.length) break;
  all.push(...products);
  console.error(`page ${page}: +${products.length} (total ${all.length})`);
  await new Promise((r) => setTimeout(r, 400)); // polite pacing
}

await mkdir("scripts/data", { recursive: true });
await writeFile(`scripts/data/${out}-catalogue.json`, JSON.stringify(all));
const types = {};
for (const p of all) types[p.product_type || "(none)"] = (types[p.product_type || "(none)"] || 0) + 1;
console.log(JSON.stringify({ products: all.length, types }, null, 1));
