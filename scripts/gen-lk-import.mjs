#!/usr/bin/env node
/**
 * Generate the Lauritz Knudsen (L&K) import migration from the browser-scraped
 * GraphQL catalogue (scripts/data/lk-catalogue.json).
 *
 * L&K = the former Legrand India brand (Exora MCBs, enGem/englaze modular,
 * Contacta contactors, Griffin/Bimetal MCCBs). Same rules as every import:
 * in-stock, Rs 300-50,000, one row per SKU. Elume price = L&K selling -2%,
 * MRP = regular price. brand_sku = exact L&K SKU (the own-store sync
 * auto-maps + auto-applies from it). Photos hotlink L&K's media CDN.
 *
 * Output: supabase/migrations/0110a..N_lk-import-partX.sql (split, PART=450).
 */
import { readFile, writeFile } from "node:fs/promises";

const catalogue = JSON.parse(await readFile("scripts/data/lk-catalogue.json", "utf8"));

const price = (p) => p.price_range?.minimum_price?.final_price?.value ?? null;
const mrpOf = (p) => p.price_range?.minimum_price?.regular_price?.value ?? null;
const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();
const esc = (s) => String(s).replace(/'/g, "''");

// L&K category names -> Elume categories, first match wins. L&K is a
// switchgear+wiring-devices house, so unmatched defaults to Switchgear.
const CAT_MAP = [
  [/MCB|RCCB|RCBO|RCD|Isolator|MCCB|Changeover|Contactor|Starter|Motor Protect|Overload|Distribution Protection|Final Distribution|Metal Clad|Rotary|Fuse|Surge|SPD/i, "Switchgear"],
  [/Switch|Socket|Modular|Cover Plate|Plate|Regulator|Dimmer|Fan Regulator|Bell|Doorbell|enGem|englaze|Roma|Myrio/i, "Modular"],
  [/Distribution Board|Consumer Unit|\bDB\b|Enclosure|Cabinet|Kit Kat|Board/i, "DB & Panels"],
  [/EV|Electric Vehicle|Charger/i, "EV Charging"],
  [/Light|Lumin|LED|Batten|Downlight|Panel Light|Flood/i, "Lighting"],
  [/Fan\b|Ceiling Fan|Exhaust/i, "Fans"],
  [/Wire|Cable|Conductor/i, "Wires & Cables"],
  [/Wiring Accessor|Lug|Gland|Terminal|Junction|Accessor|Conduit/i, "Electrical Accessories"],
];

function elumeCategory(p) {
  const names = (p.categories ?? []).map((c) => c.name).join(" ");
  const hay = `${names} ${p.name}`;
  for (const [re, cat] of CAT_MAP) if (re.test(hay)) return cat;
  return "Switchgear";
}

const eligible = catalogue.filter((p) => {
  const v = price(p);
  return p.stock_status === "IN_STOCK" && v != null && v > 300 && v <= 50000;
});

const rows = [];
const seenIds = new Set();
let i = 0;
const catCount = {};
for (const p of eligible) {
  const id = ("lk-" + String(p.sku).toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 60);
  if (seenIds.has(id)) continue;
  seenIds.add(id);
  const v = price(p);
  const mrp = Math.max(mrpOf(p) ?? v, v);
  const elume = Math.round(v * 0.98);
  const cat = elumeCategory(p);
  catCount[cat] = (catCount[cat] || 0) + 1;
  const desc = stripHtml(p.description?.html).slice(0, 400);
  const spec = desc || p.name;
  const img = p.media_gallery?.[0]?.url ? String(p.media_gallery[0].url).split("?")[0] : null;
  const name = /lauritz|l&k|l & k/i.test(p.name) ? p.name : `Lauritz Knudsen ${p.name}`;
  rows.push(
    `  ('${id}', '${esc(p.sku)}', '${esc(p.sku)}', '${esc(name.slice(0, 140))}', 'Lauritz Knudsen', '${cat}', '${esc(spec)}', ${mrp}, ${elume}, 'pc', ${img ? `'${esc(img)}'` : "null"}, true, true, ${17000 + i++})`
  );
}

const PART = 450;
const totalParts = Math.ceil(rows.length / PART);
const header = (part, count) => `-- 0110 part ${part}/${totalParts}: Lauritz Knudsen (L&K) import - in-stock SKUs Rs 300-50,000.
-- Source: smartshop.lk-ea.com Magento GraphQL, scraped ${new Date().toISOString().slice(0, 10)} (browser
-- session; the endpoint WAF-blocks server-side fetches). ${count} rows in this
-- part. Run parts IN ORDER. Pricing: store selling price -2%; MRP = regular.
-- brand_sku = exact L&K SKU. After the LAST part: "Rebuild mappings now" in
-- /admin/compare, then the competitor price sync auto-maps L&K.
insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, sort_order)
values
`;
for (let part = 0; part < totalParts; part++) {
  const chunk = rows.slice(part * PART, (part + 1) * PART);
  let sql = header(part + 1, chunk.length) + chunk.join(",\n") + "\non conflict (id) do nothing;\n";
  if (part === totalParts - 1) {
    sql += `
-- L&K as an own-brand price source (auto-map by SKU + auto-apply Rs 1 under).
insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order)
  values ('lk', 'Lauritz Knudsen', 'https://smartshop.lk-ea.com', true, false, 17)
  on conflict (id) do update set enabled = true, site_url = excluded.site_url;
`;
  }
  const suffix = totalParts > 1 ? String.fromCharCode(97 + part) : "";
  await writeFile(`supabase/migrations/0110${suffix}_lk-import${totalParts > 1 ? `-part${part + 1}` : ""}.sql`, sql);
}
console.log(JSON.stringify({ eligible: eligible.length, rows: rows.length, parts: totalParts, cats: catCount, withImage: rows.filter((r) => r.includes("http")).length }));
