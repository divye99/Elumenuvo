#!/usr/bin/env node
/**
 * Generate the ABB import migration from the scraped catalogue.
 *
 * Owner scope (Aug 2026): every in-stock, anonymously-priced SKU at or under
 * ₹50,000 - the lakh-range MCCBs/ACBs and login-priced B2B lines wait.
 * Pricing follows the house rule: Elume price = ABB eMart selling price -2%,
 * MRP = ABB list price (regular). Photos hotlink ABB's product CDN (same
 * pattern as every import; the rehost pass comes later).
 *
 * Output: supabase/migrations/0100_abb-import.sql
 */
import { readFile, writeFile } from "node:fs/promises";

const catalogue = JSON.parse(await readFile("scripts/data/abb-catalogue.json", "utf8"));
const images = JSON.parse(await readFile("scripts/data/abb-images.json", "utf8"));

const price = (p) => p.price_range?.minimum_price?.final_price?.value ?? null;
const mrpOf = (p) => p.price_range?.minimum_price?.regular_price?.value ?? null;

// ABB shop category names → Elume categories, first match wins.
const CAT_MAP = [
  [/^(MCB|RCD|RCCB|RCBO|Isolat|Electrical Protection|Surge|Fuse|Timer|Transfer Switch|Changeover|MCCB|Contactors|Pilot devices|Motor Protection|Overload|Manual Motor|Softstarter|Switch-Disconnect|Enclosed switch)/i, "Switchgear"],
  [/^(Switches, Sockets|Switches & Sockets|Cover plate|Modular)/i, "Modular"],
  [/^(Distribution Enclosure|Distribution Board|DB\b|Consumer unit|Enclosure)/i, "DB & Panels"],
  [/^(EV |Electric Vehicle)/i, "EV Charging"],
  [/^(Wiring Accessor|Cable Gland|Lugs|Terminal|Accessor)/i, "Electrical Accessories"],
  [/^(Light|Lumin)/i, "Lighting"],
];

function elumeCategory(p) {
  const names = (p.categories ?? []).map((c) => c.name);
  for (const n of names) for (const [re, cat] of CAT_MAP) if (re.test(n)) return cat;
  // Default: ABB is a switchgear brand - anything unmapped in Electrification
  // or Energy Distribution is protection/control gear.
  return "Switchgear";
}

const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/'/g, "''");

const eligible = catalogue.filter((p) => {
  const v = price(p);
  return p.stock_status === "IN_STOCK" && v != null && v > 300 && v <= 50000;
});

let rows = [];
let i = 0;
const seenIds = new Set();
for (const p of eligible) {
  const id = ("abb-" + p.sku.toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 60);
  // Prefer the real ABB order code (url_key prefix, e.g. 1SCA123957R1001)
  // over the store's internal hash sku - it is what electricians know, and
  // the sync adapter resolves either via search.
  const urlCode = (p.url_key ?? "").split("/")[0]?.toUpperCase();
  const orderCode = /^[0-9][A-Z0-9]{9,}$/.test(urlCode ?? "") ? urlCode : p.sku;
  if (seenIds.has(id)) continue;
  seenIds.add(id);
  const v = price(p);
  const mrp = Math.max(mrpOf(p) ?? v, v);
  const elume = Math.round(v * 0.98);
  const cat = elumeCategory(p);
  const desc = stripHtml(p.description?.html).slice(0, 400);
  const shortD = stripHtml(p.short_description?.html).slice(0, 200);
  const spec = [desc || shortD || null].filter(Boolean).join(" · ") || p.name;
  const img = images[p.sku] ? images[p.sku].split("?")[0] : null;
  // The catalogue's own name rarely repeats the brand - prefix for consistency.
  const name = /^abb/i.test(p.name) ? p.name : `ABB ${p.name}`;
  rows.push(
    `  ('${id}', '${esc(orderCode)}', '${esc(orderCode)}', '${esc(name.slice(0, 140))}', 'ABB', '${cat}', '${esc(spec)}', ${mrp}, ${elume}, 'pc', ${img ? `'${esc(img)}'` : "null"}, true, true, ${10000 + i++})`
  );
}

const PART = 450;
const header = (part, total, count) => `-- 0100 part ${part}/${total}: ABB eMart import - in-stock SKUs priced <= Rs 50,000.
-- Source: shop.in.abb.com Magento GraphQL, scraped ${new Date().toISOString().slice(0, 10)}.
-- ${count} products in this part (split because a single 2,567-row insert
-- was too large for the SQL editor). Run parts IN ORDER. Pricing: eMart
-- selling price -2%; MRP = list price. After the LAST part: "Rebuild
-- mappings now" in /admin/compare, then the IndexNow full-site submit.
insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, sort_order)
values
`;
const totalParts = Math.ceil(rows.length / PART);
for (let part = 0; part < totalParts; part++) {
  const chunk = rows.slice(part * PART, (part + 1) * PART);
  let sql = header(part + 1, totalParts, chunk.length) + chunk.join(",\n") + "\non conflict (id) do nothing;\n";
  if (part === totalParts - 1) {
    sql += `
-- ABB eMart as an own-brand price source: the GitHub competitor sync
-- auto-maps every ABB product by its brand SKU and auto-applies our price
-- at Rs 1 under the eMart selling price (same rules as Havells/Legrand).
insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order)
  values ('abb', 'ABB eMart', 'https://shop.in.abb.com', true, false, 13)
  on conflict (id) do update set enabled = true, site_url = excluded.site_url;
`;
  }
  await writeFile(`supabase/migrations/0100${String.fromCharCode(97 + part)}_abb-import-part${part + 1}.sql`, sql);
}
const cats = {};
for (const p of eligible) cats[elumeCategory(p)] = (cats[elumeCategory(p)] || 0) + 1;
console.log("rows:", rows.length, "in", totalParts, "part files | categories:", JSON.stringify(cats));
console.log("with image:", rows.filter((r) => r.includes("media/catalog")).length);
