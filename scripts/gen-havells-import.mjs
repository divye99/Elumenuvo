#!/usr/bin/env node
/**
 * Generate the Havells catalogue import + prune migrations from the scrape.
 *
 *   node --env-file=.env.local scripts/gen-havells-import.mjs
 *
 * Reads:  scripts/data/havells-catalogue.json  (scrape-havells-catalogue.mjs)
 *         live products (anon key, read-only) for reconciliation
 * Writes: supabase/migrations/0041_havells-import-partN.sql   (adds + updates)
 *         supabase/migrations/0042_havells-prune.sql          (removals)
 *
 * Rules (user decisions, Jul 2026):
 *   - Electrical categories only (the scrape is already scoped).
 *   - New products sell at Havells' own price MINUS 2%; MRP = their regular price.
 *   - Only IN_STOCK variants are imported; OOS items still count as "present on
 *     the site" so the prune step never removes them from Elume.
 *   - Existing Elume rows keep their id and elume_price; we refresh MRP, fill
 *     missing images, upgrade brand_sku to the true per-colour SKU, and MERGE
 *     the scraped description/key-features INTO tech_specs without touching
 *     curated fields (curated keys win on conflict).
 *   - Elume Havells rows not present on havells.com: archived when referenced
 *     by an order, deleted otherwise.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = JSON.parse(readFileSync(path.join(ROOT, "scripts/data/havells-catalogue.json"), "utf8"));
const MIG = path.join(ROOT, "supabase/migrations");

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
if (!SUPABASE_URL || !ANON) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON key (use --env-file=.env.local)"); process.exit(1); }

/* ── Category mapping: most specific Havells category wins ── */
const CAT_IDS = {
  db:      [133],                                        // Distribution Board (under Switchgears)
  gi:      [3283],                                       // GI Boxes
  wires:   [101, 102, 1116, 107, 108, 109, 111, 1008, 113],
  modular: [3232, 3289, 1044, 3601, 3155, 833, 829, 834, 1113, 114, 211, 838, 3292, 3862],
  acc:     [3256, 3259, 3262, 3265, 3268, 3271, 3238, 804, 4114], // accessories + MFD capacitors
  ev:      [3808, 3811],
  pumps:   [98, 127, 99, 100, 207, 375, 374, 962, 968],
  swg:     [124, 960, 131, 959, 125, 978],
  fans:    [50, 51, 56, 57, 61, 62, 63, 64],
  light:   [116, 282, 120, 286, 118, 119, 283, 121, 117, 123, 284, 3727, 3733, 3736, 3739, 3730, 3742, 3745],
};
const CAT_NAME = { db: "DB & Panels", gi: "DB & Panels", wires: "Wires & Cables", modular: "Modular", acc: "Electrical Accessories", ev: "EV Charging", pumps: "Pumps", swg: "Switchgear", fans: "Fans", light: "Lighting" };
const ORDER = ["db", "gi", "wires", "modular", "acc", "ev", "pumps", "swg", "fans", "light"];
// Products tagged ONLY with the "Switches & Accessories" root (id 83) are the
// REO / REO Marvel economy range: switches and plates go to Modular, true
// accessories (plug tops, night lamps...) to Electrical Accessories.
const REO_ACC_RE = /plug top|night lamp|extension|adaptor|adapter|door ?bell|lamp holder|ceiling rose|multi[- ]?plug|spike/i;

function mapCategory(p) {
  const ids = new Set((p.categories || []).map((c) => c.id));
  for (const k of ORDER) if (CAT_IDS[k].some((id) => ids.has(id))) return CAT_NAME[k];
  if (ids.has(83)) return REO_ACC_RE.test(p.name) ? "Electrical Accessories" : "Modular";
  return null;
}
function leafCategory(p) {
  const cats = (p.categories || []).filter((c) => c.id !== 2);
  cats.sort((a, b) => (b.url_path?.split("/").length ?? 0) - (a.url_path?.split("/").length ?? 0));
  return cats[0]?.name ?? null;
}

/* ── helpers ── */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (o) => `${q(JSON.stringify(o))}::jsonb`;
const stripHtml = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
const norm = (s) => String(s || "").trim().toUpperCase();
const cleanName = (s) => String(s || "").replace(/\s+/g, " ").trim();
const money = (v) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v) : null);

const SPEC_SKIP = new Set(["Manufactured By", "Country Of Origin", "Packaging Dimensions", "Net Contents", "Net Quantity", "Product range"]);
function buildSpec(specsObj, leaf) {
  const parts = [];
  if (leaf) parts.push(leaf);
  for (const [k, v] of Object.entries(specsObj ?? {})) {
    if (SPEC_SKIP.has(k)) continue;
    parts.push(`${k} ${v}`);
    if (parts.join(" · ").length > 150) break;
  }
  return parts.length > 1 ? parts.join(" · ").slice(0, 180) : (leaf ?? null);
}

function buildTechSpecs(p, pdp) {
  const specs = { ...(pdp?.techSpecs ?? {}) };
  if (pdp?.netQuantity) specs["Net Quantity"] = pdp.netQuantity;
  const leaf = leafCategory(p);
  if (leaf && !specs["Product range"]) specs["Product range"] = leaf;
  const desc = stripHtml(p.description?.html) || stripHtml(p.meta_description) || null;
  const out = { source: "havells.com" };
  if (desc) out.description = desc.slice(0, 700);
  if (pdp?.keyFeatures?.length) out.key_features = pdp.keyFeatures.slice(0, 12);
  if (pdp?.featureCards?.length) out.features = pdp.featureCards.slice(0, 8);
  if (Object.keys(specs).length) out.specs = specs;
  return out;
}

const imageOf = (galleryOwner) => {
  const g = (galleryOwner?.media_gallery ?? []).filter((m) => m?.url && !m.disabled);
  g.sort((a, b) => (a.position ?? 99) - (b.position ?? 99));
  return g[0]?.url ?? null;
};

/* ── Variant dimensions ──
 * Havells configurables vary on up to NINE dimensions, not just colour: the
 * wire families carry BOTH 90 m and 180 m coils as variants of one product.
 * Every dimension becomes an attrs key (feeding the storefront variant picker
 * and the coil-length integrity checks) and a name suffix. */
const DIM_KEY = {
  color: "Colour",
  length: "Length",
  sweep_size: "Sweep",
  wattage: "Wattage",
  lighting_color_temp: "Colour temp",
  switchgear_ampere_capacity_variant: "Rating",
  sg_rating_variant: "Capacitance",
  size: "Size",
  cable_size_varient: "Size",
};
const DIM_ORDER = ["Colour", "Size", "Sweep", "Wattage", "Rating", "Capacitance", "Colour temp", "Length"];
function variantDims(v) {
  const out = {};
  for (const a of v.attributes ?? []) {
    const k = DIM_KEY[a.code] ?? a.code;
    if (a.label) out[k] = String(a.label).trim();
  }
  return out;
}
/** Name suffix: every dim label not already in the base name; "90 m" is the
 *  norm for wire coils and stays implicit (matching the existing catalogue
 *  convention, e.g. "... — Red" vs "... — Red · 180 m"). */
function nameSuffix(dims, baseName) {
  const base = baseName.toLowerCase();
  const parts = [];
  for (const k of DIM_ORDER) {
    const label = dims[k];
    if (!label) continue;
    if (k === "Length" && /^90\s*m$/i.test(label)) continue;
    if (base.includes(label.toLowerCase())) continue;
    parts.push(label);
  }
  return parts.length ? ` — ${parts.join(" · ")}` : "";
}
const normLen = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "");

/* The PDP spec table reflects the configurable's DEFAULT variant, so a 20 W
 * panel's shared table can read "Wattage 10 W". Where a variant dimension
 * states the true value, it overrides the matching spec keys. */
const DIM_SPEC_KEYS = {
  Wattage: /^wattage/i,
  Sweep: /^sweep/i,
  Length: /^(length|coil)/i,
  "Colour temp": /colou?r temperature|^cct$/i,
  Size: /^size$/i,
  Colour: /^(body )?colou?r$/i,
  Capacitance: /capacitance/i,
};
function applyDimOverrides(tech, dims) {
  if (!tech.specs || !Object.keys(dims).length) return tech;
  const specs = { ...tech.specs };
  for (const [dim, re] of Object.entries(DIM_SPEC_KEYS)) {
    if (!dims[dim]) continue;
    for (const k of Object.keys(specs)) if (re.test(k)) specs[k] = dims[dim];
  }
  return { ...tech, specs };
}

/* ── live catalogue (read-only) ── */
async function fetchExisting() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand_sku,category,attrs,image_url,mrp,elume_price,parent_id,is_active&brand=eq.Havells&order=id&limit=1000&offset=${from}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error(JSON.stringify(rows));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function main() {
  const existing = await fetchExisting();
  const bySku = new Map(); // norm brand_sku → existing rows
  for (const e of existing) {
    if (!e.brand_sku) continue;
    const k = norm(e.brand_sku);
    (bySku.get(k) ?? bySku.set(k, []).get(k)).push(e);
  }

  const usedIds = new Set(existing.map((e) => e.id));
  const usedSkus = new Set();
  const inserts = [];   // SQL value tuples
  const updates = [];   // SQL statements
  const presentSkus = new Set(); // everything that EXISTS on the site (any stock state)
  let matchedRows = 0, newRows = 0, skippedOOS = 0, skippedZero = 0, families = 0;

  const idFor = (sku) => {
    let base = `hav-${String(sku).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    let id = base, n = 2;
    while (usedIds.has(id)) id = `${base}-${n++}`;
    usedIds.add(id);
    return id;
  };

  const rowSql = (r) => `(${q(r.id)}, ${q(r.sku)}, ${q(r.name)}, 'Havells', ${q(r.category)}, ${r.spec ? q(r.spec) : "null"}, ${r.mrp}, ${r.price}, ${q(r.unit)}, ${r.image ? q(r.image) : "null"}, ${r.attrs ? jsonb(r.attrs) : "null"}, ${q(r.brand_sku)}, ${r.parent ? q(r.parent) : "null"}, ${jsonb(r.tech)}, true)`;

  for (const p of DATA.products) {
    const category = mapCategory(p);
    if (!category) { console.log(`  UNMAPPED (skipped): ${p.sku} ${p.name}`); continue; }
    const unit = category === "Wires & Cables" ? "coil" : "pc";
    const pdp = p.pdp?.error ? null : p.pdp;
    const tech = buildTechSpecs(p, pdp);
    const leaf = leafCategory(p);
    const spec = buildSpec(tech.specs, leaf);
    const variants = (p.variants ?? []).filter((v) => v?.product?.sku);

    presentSkus.add(norm(p.sku));
    for (const v of variants) presentSkus.add(norm(v.product.sku));

    // Is this product already represented in Elume? (parent OR any variant SKU)
    const matchKeys = [norm(p.sku), ...variants.map((v) => norm(v.product.sku))];
    const matchedExisting = matchKeys.flatMap((k) => bySku.get(k) ?? []);

    const live = variants.filter((v) => v.product.stock_status === "IN_STOCK" && money(v.product.price_range?.minimum_price?.final_price?.value));
    skippedOOS += variants.length - live.length;

    // Emit one INSERT row for a live variant.
    const insertVariant = (v, parentId) => {
      const sku = v.product.sku;
      if (usedSkus.has(norm(sku))) return parentId;
      usedSkus.add(norm(sku));
      const dims = variantDims(v);
      const final = money(v.product.price_range.minimum_price.final_price.value);
      const mrp = money(v.product.price_range?.minimum_price?.regular_price?.value) ?? final;
      const id = idFor(sku);
      const baseName = cleanName(p.name);
      const attrs = { ...dims };
      const sweep = pdp?.techSpecs?.["Sweep Size"];
      if (category === "Fans" && !attrs.Sweep && sweep) attrs.Sweep = /mm/i.test(sweep) ? sweep : `${sweep} mm`;
      const vtech = applyDimOverrides(tech, dims);
      inserts.push(rowSql({
        id, sku,
        name: `Havells ${baseName}${nameSuffix(dims, baseName)}`,
        category,
        spec: buildSpec(vtech.specs, leaf),
        mrp: Math.max(mrp, Math.round(final * 0.98)),
        price: Math.round(final * 0.98),
        unit,
        image: imageOf(v.product) ?? imageOf(p),
        attrs: Object.keys(attrs).length ? attrs : null,
        brand_sku: sku, parent: parentId, tech: vtech,
      }));
      newRows++;
      return parentId ?? id;
    };

    if (matchedExisting.length) {
      // The product is already represented in Elume. Pair each existing row to
      // its exact variant on colour AND length: the wire configurables carry
      // 90 m and 180 m coils side by side, and a colour-only pairing would
      // refresh a 90 m row with 180 m data (the exact bug class fixed in 0040).
      const claimed = new Set(); // variant SKUs owned by an existing row
      const seen = new Set();
      const hasLenDim = variants.some((v) => variantDims(v).Length);
      for (const e of matchedExisting) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        matchedRows++;
        const col = (e.attrs?.Colour || "").toLowerCase();
        const len = normLen(e.attrs?.Length || (unit === "coil" ? "90 m" : ""));
        const v = col
          ? variants.find((x) => {
              const d = variantDims(x);
              if ((d.Colour || "").toLowerCase() !== col) return false;
              return hasLenDim ? normLen(d.Length) === len : true;
            })
          : null;
        if (v) claimed.add(norm(v.product.sku));
        const sets = [];
        // MRP only from the EXACT paired variant; a fallback to the parent's
        // price range would leak another length's MRP into this row.
        const mrp = money(v?.product?.price_range?.minimum_price?.regular_price?.value)
          ?? (!variants.length ? money(p.price_range?.minimum_price?.regular_price?.value) : null);
        if (mrp && mrp !== Math.round(Number(e.mrp))) sets.push(`mrp = ${mrp}`);
        if (v && norm(e.brand_sku) !== norm(v.product.sku)) sets.push(`brand_sku = ${q(v.product.sku)}`);
        if (!e.image_url) {
          const img = imageOf(v?.product) ?? imageOf(p);
          if (img) sets.push(`image_url = ${q(img)}`);
        }
        // Merge scraped description/features INTO tech_specs; curated keys win.
        sets.push(`tech_specs = ${jsonb(tech)} || coalesce(tech_specs, '{}'::jsonb)`);
        updates.push(`update public.products set ${sets.join(", ")} where id = ${q(e.id)};`);
      }
      // Variants Elume does NOT stock yet (new colours, the 180 m coils...)
      // join the EXISTING family so the picker shows one complete range.
      const withColour = matchedExisting.find((e) => e.attrs?.Colour);
      const anchor = withColour ?? matchedExisting[0];
      const familyParent = anchor.parent_id ?? anchor.id;
      for (const v of live) {
        if (claimed.has(norm(v.product.sku))) continue;
        insertVariant(v, familyParent);
      }
      continue;
    }

    // New product. Configurable → one row per in-stock variant, the first is
    // the family parent. Simple → one row.
    if (variants.length) {
      if (!live.length) continue;
      families++;
      let parentId = null;
      for (const v of live) parentId = insertVariant(v, parentId);
    } else {
      if (p.stock_status !== "IN_STOCK") { skippedOOS++; continue; }
      const final = money(p.price_range?.minimum_price?.final_price?.value);
      if (!final) { skippedZero++; continue; }
      if (usedSkus.has(norm(p.sku))) continue;
      usedSkus.add(norm(p.sku));
      const mrp = money(p.price_range?.minimum_price?.regular_price?.value) ?? final;
      inserts.push(rowSql({ id: idFor(p.sku), sku: p.sku, name: `Havells ${cleanName(p.name)}`, category, spec, mrp: Math.max(mrp, Math.round(final * 0.98)), price: Math.round(final * 0.98), unit, image: imageOf(p), attrs: null, brand_sku: p.sku, parent: null, tech }));
      newRows++;
    }
  }

  /* ── invariants: fail loudly rather than ship a broken migration ── */
  {
    const seenIds = new Set(existing.map((e) => e.id));
    for (const [i, tuple] of inserts.entries()) {
      const m = tuple.match(/^\('([^']+)'/);
      if (!m) throw new Error(`Row ${i}: cannot read id`);
      if (seenIds.has(m[1])) throw new Error(`Duplicate id: ${m[1]}`);
      seenIds.add(m[1]);
      // parent_id must reference an id already inserted OR an existing row
      // (children can join a pre-existing Elume family)
      const pm = tuple.match(/, ('[^']+'|null), '\{"source/);
      if (pm && pm[1] !== "null" && !seenIds.has(pm[1].slice(1, -1))) throw new Error(`Row ${i}: parent ${pm[1]} not inserted before child`);
      // every '...'::jsonb blob must be valid JSON after unescaping
      for (const j of tuple.matchAll(/'((?:[^']|'')*)'::jsonb/g)) JSON.parse(j[1].replace(/''/g, "'"));
    }
    console.log(`Invariants OK: ${inserts.length} unique ids, parents precede children, jsonb parses.`);
  }

  /* ── write import migration in parts ── */
  const HEADER = `-- ═══════════════════════════════════════════════════════════════
-- 0041 · Havells catalogue import (generated by scripts/gen-havells-import.mjs)
--
-- Full electrical catalogue from havells.com (${DATA.scrapedAt}): Fans,
-- Lighting, Switches & Accessories, Home Electricals, Green Energy. Consumer
-- appliances excluded. One row per in-stock COLOUR variant, each with its own
-- manufacturer SKU (brand_sku); the first variant is the family parent.
-- Pricing: elume_price = Havells selling price minus 2%; mrp = their MRP.
-- tech_specs carries the scraped description, key features, feature cards and
-- the full Technical Specifications table. Existing rows are refreshed
-- (MRP / missing image / per-colour brand_sku / tech_specs merge) and keep
-- their id and elume_price. Idempotent: inserts use on conflict do nothing.
-- ═══════════════════════════════════════════════════════════════\n\n`;

  const COLS = "(id, sku, name, brand, category, spec, mrp, elume_price, unit, image_url, attrs, brand_sku, parent_id, tech_specs, is_active)";
  const PER_PART = 400;
  const parts = [];
  for (let i = 0; i < inserts.length; i += PER_PART) parts.push(inserts.slice(i, i + PER_PART));
  parts.forEach((chunk, idx) => {
    let sql = HEADER + `-- Part ${idx + 1} of ${parts.length} · ${chunk.length} products\n-- RUN PARTS IN ORDER: a colour family can straddle a part boundary, and a\n-- child's parent_id references a row inserted in the previous part.\n\n`;
    sql += `insert into public.products ${COLS} values\n${chunk.join(",\n")}\non conflict (id) do nothing;\n`;
    if (idx === parts.length - 1 && updates.length) {
      sql += `\n-- ── Refresh existing Elume Havells rows (${updates.length} statements) ──\n${updates.join("\n")}\n`;
    }
    writeFileSync(path.join(MIG, `0041_havells-import-part${idx + 1}.sql`), sql);
  });

  /* ── prune migration ── */
  const missing = existing.filter((e) => !e.brand_sku || !presentSkus.has(norm(e.brand_sku)));
  // Rows whose family parent SKU matches (children carrying parent's -C SKU)
  // are already covered by presentSkus. What remains is genuinely absent.
  const pruneIds = missing.map((e) => e.id);
  let prune = `-- ═══════════════════════════════════════════════════════════════
-- 0042 · Havells prune (generated by scripts/gen-havells-import.mjs)
--
-- Elume Havells products NOT found anywhere on havells.com (${DATA.scrapedAt},
-- matched by manufacturer SKU against every product and colour variant,
-- including out-of-stock listings). Per user decision: rows referenced by an
-- order are ARCHIVED (is_active = false, hidden by RLS); the rest are deleted.
-- competitor_map / competitor_prices / reviews cascade on delete.
-- ═══════════════════════════════════════════════════════════════\n\n`;
  if (pruneIds.length) {
    const list = pruneIds.map(q).join(",\n  ");
    prune += `-- ${pruneIds.length} product(s): ${missing.slice(0, 12).map((e) => e.id).join(", ")}${missing.length > 12 ? ", ..." : ""}\n\n`;
    prune += `update public.products p set is_active = false\nwhere p.id in (\n  ${list}\n)\nand exists (select 1 from public.orders o where o.items @> jsonb_build_array(jsonb_build_object('id', p.id)));\n\n`;
    prune += `delete from public.products p\nwhere p.id in (\n  ${list}\n)\nand not exists (select 1 from public.orders o where o.items @> jsonb_build_array(jsonb_build_object('id', p.id)));\n`;
  } else {
    prune += "-- Nothing to prune: every Elume Havells product exists on havells.com.\n";
  }
  writeFileSync(path.join(MIG, "0042_havells-prune.sql"), prune);

  console.log(`Existing Elume Havells rows: ${existing.length} (matched on site: ${matchedRows}, absent: ${pruneIds.length})`);
  console.log(`New rows to insert: ${newRows} (${families} colour families) across ${parts.length} part files`);
  console.log(`Skipped: ${skippedOOS} out-of-stock variants/products, ${skippedZero} zero-price`);
  console.log(`Absent (prune candidates): ${missing.map((e) => `${e.id} [${e.category}] ${e.name}`).slice(0, 40).join("\n  ")}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
