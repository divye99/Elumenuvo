#!/usr/bin/env node
/**
 * Scrape the full ABB eMart India catalogue from shop.in.abb.com.
 *
 * Same playbook as the Havells importer: the store is Magento 2 with an open
 * GraphQL endpoint (verified Aug 2026; store_code "india", root category 594).
 * Unlike Havells, EVERYTHING needed ships inline in GraphQL - description
 * html, media gallery, prices (final = selling, regular = MRP), stock and
 * category memberships - so there is no per-PDP HTML pass.
 *
 * Roots crawled (owner scope: "every single product"):
 *   597  Electrification   (~10.8k)
 *   795  Residential        (~2.9k)
 *   861  Industrial         (~8.7k)
 *   1462 Automation&Control (~4.1k)
 *   1561 Energy Distribution(~4.7k)
 * Products overlap across roots; dedupe is by SKU.
 *
 * Output: scripts/data/abb-catalogue.json
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "data", "abb-catalogue.json");
const GQL = "https://shop.in.abb.com/graphql";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ROOTS = [
  { id: "597", name: "Electrification" },
  { id: "795", name: "Residential" },
  { id: "861", name: "Industrial" },
  { id: "1462", name: "Automation & Control" },
  { id: "1561", name: "Energy Distribution" },
];

const PRODUCT_FIELDS = `
  sku name url_key stock_status
  description { html } short_description { html }
  media_gallery { url label position disabled }
  price_range { minimum_price { regular_price { value } final_price { value } } }
  categories { id name url_path }
  __typename
  ... on ConfigurableProduct {
    variants { product { sku name stock_status price_range { minimum_price { regular_price { value } final_price { value } } } media_gallery { url label } } attributes { code label } }
  }
`;

async function gql(query, attempt = 1) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(GQL, {
      method: "POST",
      signal: ctl.signal,
      headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query }),
    });
    clearTimeout(t);
    const json = await res.json();
    if (json.errors && !json.data) throw new Error(JSON.stringify(json.errors).slice(0, 200));
    return json.data;
  } catch (e) {
    if (attempt >= 4) throw e;
    await sleep(2000 * attempt);
    return gql(query, attempt + 1);
  }
}

async function crawlRoot(root, bySku) {
  const pageSize = 100;
  let page = 1;
  let total = null;
  for (;;) {
    const q = `{products(filter:{category_id:{eq:"${root.id}"}}, pageSize:${pageSize}, currentPage:${page}){
      total_count page_info { total_pages }
      items { ${PRODUCT_FIELDS} }
    }}`;
    let data;
    try {
      data = await gql(q);
    } catch (e) {
      console.error(`  [${root.name}] page ${page} failed permanently: ${e.message}`);
      break;
    }
    const block = data?.products;
    if (!block) break;
    total ??= block.total_count;
    for (const p of block.items ?? []) {
      if (!p?.sku) continue;
      if (!bySku.has(p.sku)) bySku.set(p.sku, { ...p, roots: [root.name] });
      else {
        const existing = bySku.get(p.sku);
        if (!existing.roots.includes(root.name)) existing.roots.push(root.name);
      }
    }
    process.stdout.write(`  [${root.name}] page ${page}/${block.page_info?.total_pages ?? "?"} · unique so far: ${bySku.size}\n`);
    if (page >= (block.page_info?.total_pages ?? 1)) break;
    page += 1;
    await sleep(350);
  }
  console.log(`[${root.name}] done · reported total ${total}`);
}

async function main() {
  const bySku = new Map();
  for (const root of ROOTS) {
    console.log(`Crawling root ${root.id} ${root.name}...`);
    await crawlRoot(root, bySku);
  }
  await mkdir(path.dirname(OUT), { recursive: true });
  const all = [...bySku.values()];
  await writeFile(OUT, JSON.stringify(all));
  const inStock = all.filter((p) => p.stock_status === "IN_STOCK").length;
  console.log(`\nDONE: ${all.length} unique SKUs (${inStock} in stock) → ${OUT}`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
