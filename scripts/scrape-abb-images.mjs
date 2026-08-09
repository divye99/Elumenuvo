#!/usr/bin/env node
// Second pass: sku → main image url for the whole ABB catalogue.
import { writeFile } from "node:fs/promises";
const GQL = "https://shop.in.abb.com/graphql";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ROOTS = ["597", "795", "861", "1462", "1561"];
async function gql(query, attempt = 1) {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
    const res = await fetch(GQL, { method: "POST", signal: ctl.signal, headers: { "User-Agent": UA, "Content-Type": "application/json" }, body: JSON.stringify({ query }) });
    clearTimeout(t);
    return (await res.json()).data;
  } catch (e) { if (attempt >= 4) throw e; await sleep(1500 * attempt); return gql(query, attempt + 1); }
}
const bySku = {};
for (const root of ROOTS) {
  let page = 1;
  for (;;) {
    const data = await gql(`{products(filter:{category_id:{eq:"${root}"}}, pageSize:200, currentPage:${page}){page_info{total_pages} items{sku image{url}}}}`);
    const block = data?.products; if (!block) break;
    for (const p of block.items ?? []) if (p?.sku && p.image?.url && !bySku[p.sku]) bySku[p.sku] = p.image.url;
    process.stdout.write(`root ${root} page ${page}/${block.page_info?.total_pages} imgs ${Object.keys(bySku).length}\n`);
    if (page >= (block.page_info?.total_pages ?? 1)) break;
    page += 1; await sleep(250);
  }
}
await writeFile("scripts/data/abb-images.json", JSON.stringify(bySku));
console.log("DONE images:", Object.keys(bySku).length);
