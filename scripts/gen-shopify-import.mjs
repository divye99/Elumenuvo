#!/usr/bin/env node
/**
 * Generate import migrations from a scraped Shopify catalogue (Orient, Crompton).
 *   node scripts/gen-shopify-import.mjs <orient|crompton>
 *
 * Owner scope (Aug 2026): electrical FMEG only - fans, lighting, switchgear,
 * water heaters, pumps, wires, extension boards, stabilizers. Kitchen and
 * personal appliances, coolers, torches, chargers and solar solutions stay out.
 * Pricing follows the house rule: Elume price = brand-store selling price -2%,
 * MRP = compare_at_price (never below selling). Variants become one row each,
 * grouped into a family via parent_id (first kept variant = parent) with attrs
 * from the Shopify options, so the PDP picker + card swatches work.
 * brand_sku = "handle::variantId" - exactly what the Shopify sync adapter
 * resolves per-variant, enabling auto-map + auto-apply on price sync.
 */
import { readFile, writeFile } from "node:fs/promises";

const BRANDS = {
  orient: {
    prefix: "ort",
    brand: "Orient",
    store: "Orient Electric",
    siteUrl: "https://orientelectric.com",
    file: "scripts/data/orient-catalogue.json",
    mig: "0101",
    sortBase: 13000,
    srcSort: 14,
    cats: {
      Fans: "Fans", "Ceiling Fan": "Fans",
      Lighting: "Lighting",
      Switchgears: "Switchgear",
      "Water Heaters": "Water Heaters",
      // Air Coolers, Small Appliances: out of FMEG scope
    },
  },
  crompton: {
    prefix: "cro",
    brand: "Crompton",
    store: "Crompton",
    siteUrl: "https://www.crompton.co.in",
    file: "scripts/data/crompton-catalogue.json",
    mig: "0102",
    sortBase: 14000,
    srcSort: 15,
    cats: {
      "Ceiling Fans": "Fans", "Exhaust Fans": "Fans", "Pedestal Fans": "Fans", "Wall Mounted Fans": "Fans", "Table Fans": "Fans",
      Bulbs: "Lighting", "Ceiling Lights": "Lighting", Battens: "Lighting", "Battens Tube Lights": "Lighting",
      "Outdoor Lights": "Lighting", "Professional Outdoor Lighting": "Lighting", "Intellisense Lights": "Lighting",
      "Rope and Strip Lights": "Lighting", "Table Lamp": "Lighting",
      "Agricultural Pumps": "Pumps", Mini: "Pumps", "Shallow Well Pumps": "Pumps", "Speciality Pumps": "Pumps",
      "Pressure Booster Pumps": "Pumps", "4-Inch Borewell Submersibles": "Pumps", "3-Inch Borewell Submersibles": "Pumps",
      "Residential Openwell": "Pumps", "Circulatory In-line Pumps": "Pumps", "DMB/CMB": "Pumps",
      "Control Panels": "DB & Panels",
      "Storage Water Heaters": "Water Heaters", "Instant Water Heaters": "Water Heaters", "Immersion Rods": "Water Heaters", "Gas geyser": "Water Heaters",
      "House Wires": "Wires & Cables",
      "Extension Board": "Extension Boards",
      "AC Stabilizers": "Electrical Accessories",
      // kitchen/cooking, coolers, irons, room heaters, torches, chargers,
      // power banks, mosquito racquets, dishwashers, solar: out of scope
    },
  },
};

const cfg = BRANDS[process.argv[2]];
if (!cfg) { console.error("usage: gen-shopify-import.mjs <orient|crompton>"); process.exit(1); }

const catalogue = JSON.parse(await readFile(cfg.file, "utf8"));

const esc = (s) => String(s).replace(/'/g, "''");
const stripHtml = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&amp;/g, " ").replace(/\s+/g, " ").trim();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Shopify option name → the storefront's canonical attr dimension.
function dim(name) {
  if (/colou?r|finish|shade/i.test(name)) return "Colour";
  if (/sweep/i.test(name)) return "Sweep";
  if (/capacity|litre|ltr/i.test(name)) return "Size";
  if (/\bsize\b/i.test(name)) return "Size";
  if (/length|cord/i.test(name)) return "Length";
  if (/watt/i.test(name)) return "Wattage";
  if (/pack/i.test(name)) return "Lot";
  return name.trim();
}

const rows = [];
const seenIds = new Set();
let i = 0;
const catCount = {};
let skippedPrice = 0, skippedOOS = 0;

for (const p of catalogue) {
  const cat = cfg.cats[p.product_type];
  if (!cat) continue;
  const optionNames = (p.options ?? []).map((o) => dim(o.name));
  const imgByVariant = new Map();
  for (const im of p.images ?? []) for (const vid of im.variant_ids ?? []) imgByVariant.set(vid, im.src);
  const fallbackImg = p.images?.[0]?.src ?? null;
  const desc = stripHtml(p.body_html).slice(0, 400);

  let parentId = null;
  for (const v of p.variants ?? []) {
    if (v.available === false) { skippedOOS++; continue; }
    const price = Number(v.price);
    if (!Number.isFinite(price) || price <= 300 || price > 50000) { skippedPrice++; continue; }

    const attrs = {};
    [v.option1, v.option2, v.option3].forEach((val, k) => {
      if (val && val !== "Default Title" && optionNames[k]) attrs[optionNames[k]] = String(val);
    });
    const suffix = Object.values(attrs).filter((x) => !new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(p.title)).join(" · ");
    const title = /crompton|orient/i.test(p.title) ? p.title : `${cfg.brand} ${p.title}`;
    const name = (suffix ? `${title} · ${suffix}` : title).slice(0, 140);

    const idBase = v.sku ? `${cfg.prefix}-${slug(v.sku)}` : `${cfg.prefix}-${slug(p.handle)}-${v.id % 100000}`;
    const id = idBase.slice(0, 60);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const mrp = Math.max(Number(v.compare_at_price) || 0, price);
    const elume = Math.round(price * 0.98);
    const img = (imgByVariant.get(v.id) ?? fallbackImg)?.split("?")[0] ?? null;
    const spec = desc || `${p.product_type} · ${p.title}`;
    const attrsSql = Object.keys(attrs).length ? `'${esc(JSON.stringify(attrs))}'::jsonb` : "null";

    rows.push(
      `  ('${id}', '${esc(v.sku || String(v.id))}', '${esc(`${p.handle}::${v.id}`)}', '${esc(name)}', '${cfg.brand}', '${cat}', '${esc(spec)}', ${mrp}, ${elume}, 'pc', ${img ? `'${esc(img)}'` : "null"}, true, true, ${attrsSql}, ${cfg.sortBase + i++}, ${parentId ? `'${parentId}'` : "null"})`
    );
    catCount[cat] = (catCount[cat] || 0) + 1;
    if (!parentId) parentId = id; // first kept variant anchors the family
  }
}

const PART = 450;
const totalParts = Math.ceil(rows.length / PART);
const header = (part, count) => `-- ${cfg.mig} part ${part}/${totalParts}: ${cfg.store} import - electrical FMEG scope, in-stock,
-- Rs 300-50,000. Source: ${cfg.siteUrl} Shopify products.json, scraped ${new Date().toISOString().slice(0, 10)}.
-- ${count} rows in this part. Run parts IN ORDER (variant children reference
-- their parent row). Pricing: store selling price -2%; MRP = compare_at_price.
-- brand_sku = "handle::variantId" (the Shopify sync adapter's per-variant code).
-- After the LAST part: "Rebuild mappings now" in /admin/compare.
insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, attrs, sort_order, parent_id)
values
`;
for (let part = 0; part < totalParts; part++) {
  const chunk = rows.slice(part * PART, (part + 1) * PART);
  let sql = header(part + 1, chunk.length) + chunk.join(",\n") + "\non conflict (id) do nothing;\n";
  if (part === totalParts - 1) {
    sql += `
-- ${cfg.store} as an own-brand price source: the competitor sync auto-maps
-- every ${cfg.brand} product by brand_sku (handle::variantId) and auto-applies
-- our price at Rs 1 under the store's selling price (Havells rules).
insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order)
  values ('${cfg.prefix === "ort" ? "orient" : "crompton"}', '${cfg.store}', '${cfg.siteUrl}', true, false, ${cfg.srcSort})
  on conflict (id) do update set enabled = true, site_url = excluded.site_url;
`;
  }
  const suffix = totalParts > 1 ? String.fromCharCode(97 + part) : "";
  await writeFile(`supabase/migrations/${cfg.mig}${suffix}_${cfg.prefix === "ort" ? "orient" : "crompton"}-import${totalParts > 1 ? `-part${part + 1}` : ""}.sql`, sql);
}
console.log(JSON.stringify({ rows: rows.length, parts: totalParts, cats: catCount, skippedPrice, skippedOOS, withImage: rows.filter((r) => r.includes("cdn.shopify")).length }));
