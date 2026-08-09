#!/usr/bin/env node
/**
 * Havells water heaters: scrape havells.com (Magento GraphQL) + generate
 * supabase/migrations/0105_havells-water-heaters.sql
 *
 * Same rules as every Havells import: one row per IN-STOCK child variant,
 * id hav-<child sku>, brand_sku = exact Havells SKU (the own-store sync
 * auto-maps + auto-applies from it), Elume price = Havells selling -2%,
 * MRP = regular price, first kept variant anchors the family (parent_id),
 * attrs from the configurable options (Capacity/Colour). Photos hotlink
 * Havells' CDN like the main import (rehost pass later).
 */
import { writeFile } from "node:fs/promises";

const UA = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36", Store: "default", Accept: "application/json" };
const gql = async (q) => (await fetch("https://havells.com/graphql?query=" + encodeURIComponent(q), { headers: UA })).json();
const esc = (s) => String(s).replace(/'/g, "''");
const strip = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();

// 1. Discover every water-heating line via search sweeps.
const seen = new Set();
for (const term of ["water heater", "geyser", "immersion rod", "immersion heater", "instant water heater"]) {
  for (let page = 1; page <= 5; page++) {
    const d = await gql(`query{products(search:${JSON.stringify(term)},pageSize:50,currentPage:${page}){items{sku name categories{name}}}}`);
    const items = d?.data?.products?.items ?? [];
    for (const it of items) {
      const cats = (it.categories ?? []).map((c) => c.name).join(",");
      if (/water heater|geyser|immersion/i.test(cats) || /water heater|geyser|immersion/i.test(it.name)) seen.add(it.sku);
    }
    if (items.length < 50) break;
  }
}
console.error("lines:", seen.size);

// 2. Full detail per line, including the configurable variant tree.
const FIELDS = `sku name stock_status url_key description{html} media_gallery{url}
  price_range{minimum_price{regular_price{value} final_price{value}}}
  ... on ConfigurableProduct{variants{product{sku name stock_status media_gallery{url} price_range{minimum_price{regular_price{value} final_price{value}}}} attributes{code label}}}`;
const rows = [];
let i = 0;
const seenIds = new Set();
for (const sku of seen) {
  const d = await gql(`query{products(filter:{sku:{eq:${JSON.stringify(sku)}}}){items{${FIELDS}}}}`);
  const p = d?.data?.products?.items?.[0];
  if (!p) { console.error("MISS", sku); continue; }
  const desc = strip(p.description?.html).slice(0, 400);
  const parentImg = p.media_gallery?.[0]?.url?.split("?")[0] ?? null;
  const kids = (p.variants ?? []).length
    ? p.variants.map((v) => ({ ...v.product, attrs: Object.fromEntries((v.attributes ?? []).map((a) => [a.code, a.label])) }))
    : [{ ...p, attrs: {} }]; // simple product (immersion rods)
  let parentId = null;
  for (const v of kids) {
    if (v.stock_status !== "IN_STOCK") continue;
    const price = v.price_range?.minimum_price?.final_price?.value;
    if (price == null || price <= 300 || price > 50000) continue;
    const mrp = Math.max(v.price_range?.minimum_price?.regular_price?.value ?? price, price);
    const elume = Math.round(price * 0.98);
    const id = `hav-${v.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`.slice(0, 60);
    if (seenIds.has(id)) continue;
    seenIds.add(id);
    const attrs = {};
    for (const [code, label] of Object.entries(v.attrs)) {
      if (/capacity|litre/i.test(code)) attrs.Size = label;
      else if (/colou?r/i.test(code)) attrs.Colour = label;
      else attrs[code.replace(/_/g, " ")] = label;
    }
    const suffix = Object.values(attrs).join(" · ");
    const name = `Havells ${p.name}${suffix ? ` · ${suffix}` : ""}`.slice(0, 140);
    const img = (v.media_gallery?.[0]?.url ?? parentImg)?.split("?")[0] ?? null;
    const attrsSql = Object.keys(attrs).length ? `'${esc(JSON.stringify(attrs))}'::jsonb` : "null";
    rows.push(
      `  ('${id}', '${esc(v.sku)}', '${esc(v.sku)}', '${esc(name)}', 'Havells', 'Water Heaters', '${esc(desc || p.name)}', ${mrp}, ${elume}, 'pc', ${img ? `'${esc(img)}'` : "null"}, true, true, ${attrsSql}, ${16000 + i++}, ${parentId ? `'${parentId}'` : "null"})`
    );
    if (!parentId) parentId = id;
  }
  await new Promise((r) => setTimeout(r, 250));
}

const sql = `-- 0105: Havells water heaters - the brand's full geyser/instant/immersion
-- range from havells.com (Magento GraphQL), scraped ${new Date().toISOString().slice(0, 10)}. One row per
-- in-stock variant (Capacity x Colour), Havells import rules: brand_sku =
-- exact Havells SKU so the own-store price sync auto-maps + auto-applies;
-- Elume price = selling -2%; MRP = regular price. New Water Heaters category
-- (0101/0102 era). After running: "Rebuild mappings now" in /admin/compare,
-- then the GitHub competitor price sync picks these up automatically.
insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, attrs, sort_order, parent_id)
values
${rows.join(",\n")}
on conflict (id) do nothing;
`;
await writeFile("supabase/migrations/0105_havells-water-heaters.sql", sql);
console.log(JSON.stringify({ rows: rows.length, withImage: rows.filter((r) => r.includes("http")).length }));
