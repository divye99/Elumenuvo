#!/usr/bin/env node
/**
 * Generate the Lauritz Knudsen (L&K) import migration from the crawled
 * smartshop.lk-ea.com catalogue (scripts/data/lk-crawl/p*.json, 105 pages).
 *
 * L&K = the former Legrand India brand (Exora modular, MCX/ML/MNX contactors,
 * MCCBs, Exora MCBs/RCCBs/DBs, Salzer rotary switches, pump starters).
 *
 * Owner filters (applied IN ORDER, imageless product = least visibility rule):
 *   1. IN_STOCK only
 *   2. selling price > Rs 300 and <= Rs 50,000
 *   3. has a real product photo (drop Magento placeholder images)
 *   4. category pertinent to an Elume category (drop pumps/agriculture/
 *      industrial-automation/VFD/APFC/metering/signalling that we do not sell)
 *
 * Pricing: Elume = L&K selling price -2%; MRP = L&K regular price.
 * brand_sku = exact L&K SKU (the own-store price sync auto-maps + auto-applies
 * from it). Photos hotlink L&K's media CDN.
 *
 * Output: supabase/migrations/0114a..N_lk-import-partX.sql (split, PART=450).
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { assignElins } from "./lib/elin.mjs";

const DIR = "scripts/data/lk-crawl";
const files = readdirSync(DIR).filter((f) => /^p\d+\.json$/.test(f)).sort();
const raw = [];
const seenSku = new Set();
for (const f of files) {
  for (const p of JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"))) {
    if (!p.s || seenSku.has(p.s)) continue; // dedupe across category pages
    seenSku.add(p.s);
    raw.push(p);
  }
}

const isPlaceholder = (url) => !url || /\/placeholder\/|SmartShop_1\.png/i.test(url);

// L&K category leaf -> Elume category. Tested against the crawl's category
// breadcrumbs (pipe-joined in `c`). First match wins; anything unmatched is
// dropped as not-pertinent (returned null).
const CAT_RULES = [
  // Physical enclosures FIRST (Exora.N DBs carry both "Exora" and "DB").
  [/Distribution Board|Consumer Unit|\bDB\b|Enclosure/i, "DB & Panels"],
  // Modular wiring devices - keyed on device type, not brand line, since
  // Exora/Entice/enGem span switches (modular), MCBs and DBs.
  [/Modular Switch|Electric Switch|Electric Socket|Fan Regulator|Dimmer|Bell Push|Frame Mounting|Wall Plate|Cover Plate|Hotel Range|Foot Light|Spike Guard/i, "Modular"],
  [/EV Charger|TECharger|AC Charger/i, "EV Charging"],
  [/Industrial Plug|Plug & Socket|Industrial Socket/i, "Electrical Accessories"],
  // Protection / control gear.
  [/MCCB|Low Voltage Breaker|Moulded Case/i, "Switchgear"],
  [/MCB|RCCB|RCBO|\bRCD\b|ACCL|Surge Protection|Miniature Circuit|Residual Current|Mini MCB|Tripper/i, "Switchgear"],
  [/Changeover|Switch Disconnector|Bypass Switch|Isolator/i, "Switchgear"],
  [/Contactor|Overload Relay|Starter|Motor Protect|MCX|MNX|MO C|MO0|MX0/i, "Switchgear"],
  [/Fuse|Fuse Holder|Fusebase/i, "Switchgear"],
  // Fallback for the modular ranges when only the brand line is in the crumb.
  [/Entice|enGem|Englaze|enCurve|enConnect/i, "Modular"],
];
// Categories we explicitly DO NOT sell -> drop even if a rule above matches.
const REJECT = /Pump|Agriculture|Controller|Industrial  Automation|Solar Drive|AC Drive|VFD|APFC|Capacitor|PF Correction|Digital Meter|Tariff Meter|Energy Meter|Panel Meter|Rotary Switch|Salzer|ESBEE|\bGIC\b|Timers|Monitoring Relay|LED Indicators & Push|Signaling|Signalling|Digital Panel/i;

function elumeCategory(c) {
  if (!c) return null;
  if (REJECT.test(c)) return null;
  for (const [re, cat] of CAT_RULES) if (re.test(c)) return cat;
  return null;
}

const stats = { total: raw.length, oos: 0, price: 0, noPhoto: 0, offCat: 0, kept: 0, byCat: {} };
const rows = [];
const kept = [];
let i = 0;
for (const p of raw) {
  if (p.st !== "IN_STOCK") { stats.oos++; continue; }
  const sell = Number(p.f) || 0;
  if (!(sell > 300 && sell <= 50000)) { stats.price++; continue; }
  if (isPlaceholder(p.i)) { stats.noPhoto++; continue; }
  const cat = elumeCategory(p.c);
  if (!cat) { stats.offCat++; continue; }
  stats.kept++; stats.byCat[cat] = (stats.byCat[cat] || 0) + 1;
  kept.push({ p, cat });
}

// ELIN-first identity (owner, Aug 2026): the product id IS the ELIN, so the
// PDP URL is /catalogue/E---------  (Amazon-ASIN style). Seeded from the old
// "lk-<sku>" slug so regeneration is stable.
const elins = assignElins(kept.map(({ p }) => "lk-" + String(p.s).toLowerCase().replace(/[^a-z0-9]+/g, "-")));
for (const { p, cat } of kept) {
  const seed = "lk-" + String(p.s).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const elin = elins.get(seed);
  const sell = Number(p.f) || 0;
  const mrp = Math.max(Number(p.r) || sell, sell);
  const elume = Math.round(sell * 0.98);
  const name = /lauritz|l&k|l & k/i.test(p.n) ? p.n : `Lauritz Knudsen ${p.n}`;
  const spec = p.n.replace(/^Lauritz Knudsen\s*/i, "").slice(0, 300);
  const img = String(p.i).split("?")[0];
  const esc = (s) => String(s).replace(/'/g, "''");
  rows.push(
    `  ('${elin}', '${elin}', '${elin}', '${esc(p.s)}', '${esc(name.slice(0, 140))}', 'Lauritz Knudsen', '${cat}', '${esc(spec)}', ${mrp}, ${elume}, 'pc', '${esc(img)}', true, true, ${17000 + i++})`
  );
}

const PART = 450;
const totalParts = Math.ceil(rows.length / PART);
const header = (part, count) => `-- 0114 part ${part}/${totalParts}: Lauritz Knudsen (L&K) import - in-stock, photographed,
-- Rs 300-50,000, Elume-relevant categories only. ${count} rows in this part.
-- Source: smartshop.lk-ea.com Magento GraphQL (browser session; WAF-gated).
-- Pricing: store selling price -2%; MRP = regular. brand_sku = exact L&K SKU.
-- Run parts IN ORDER, AFTER 0116 (creates the elin column). id = ELIN = URL.
-- brand_sku = exact L&K SKU. After the LAST part: "Rebuild mappings now" in
-- /admin/compare, then the competitor price sync auto-maps L&K.
insert into public.products
  (id, elin, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, sort_order)
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
  writeFileSync(`supabase/migrations/0114${suffix}_lk-import${totalParts > 1 ? `-part${part + 1}` : ""}.sql`, sql);
}
console.log(JSON.stringify({ ...stats, parts: totalParts }, null, 1));
