#!/usr/bin/env node
/**
 * Generate the Elume FR house wire listing (migration 0049).
 *
 *   node --env-file=.env.local scripts/gen-elume-wire.mjs
 *
 * Elume's own label. 8 sizes x 3 coil lengths x 7 named colours = 168 SKUs,
 * one variant family (Size / Length / Colour picker dims).
 *
 * PRICING (user rule): 1.5x the HIGHEST price on our own catalogue for the
 * same size and length. Where no direct comparable exists, derived from the
 * same-size 90 m anchor with real-market coil ratios (45 m = 0.5x, 180 m =
 * 1.95x, taken from Polycab/CMI multi-length families). 10 sq mm has no
 * catalogue comparable at all, so its 90 m base = 1.6x the 6 sq mm anchor
 * (typical market step between those sizes), lengths derived from there.
 * Prices are rounded to a clean 50; MRP EQUALS the price. The price is the
 * price: this listing does not do discount theatre.
 *
 * COLOURS, named as a single palette of light (the brand is called Elume):
 *   Ultraviolet (bright purple) · Solar Flare (yellow) · Aurora (green)
 *   Ember (red) · Midnight (blue) · Moonlight (white) · Eclipse (black)
 * The electrical colour stays in the spec text for code compliance.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
if (!SUPABASE_URL || !ANON) { console.error("Missing env (use --env-file=.env.local)"); process.exit(1); }

const SIZES = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10];
const LENGTHS = [45, 90, 180];
const COLOURS = [
  { name: "Ultraviolet", real: "bright purple" },
  { name: "Solar Flare", real: "yellow" },
  { name: "Aurora", real: "green" },
  { name: "Ember", real: "red" },
  { name: "Midnight", real: "blue" },
  { name: "Moonlight", real: "white" },
  { name: "Eclipse", real: "black" },
];

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (o) => `${q(JSON.stringify(o))}::jsonb`;
const round50 = (n) => Math.round(n / 50) * 50;
const sizeSlug = (s) => String(s).replace(".", "p");

/* ── anchors: highest catalogue price per (size, length) ── */
async function anchors() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,attrs,spec,elume_price&category=eq.Wires%20%26%20Cables&order=id&limit=1000&offset=${from}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const page = await r.json();
    all.push(...page);
    if (page.length < 1000) break;
  }
  const HOUSE = /house wire|hrfr|fr-lsh|hffr|frls|lifeline|life line|life guard|life shield|maxima|greenshield|conflame|anushakti|shakti|homelite|flame/i;
  const cands = []; // { size, len, price, perM, who }
  for (const p of all) {
    if (p.brand === "Elume") continue; // never anchor on ourselves (rerun safety)
    const text = `${p.name} ${p.spec ?? ""}`;
    if (!HOUSE.test(text)) continue;
    const sm = text.match(/(\d+(?:\.\d+)?)\s*sq\.?\s*mm/i);
    if (!sm) continue;
    const size = parseFloat(sm[1]);
    if (!SIZES.includes(size)) continue;
    // Length: attrs first, then the NAME (the Lifeline FR family carries
    // "180 m" in the name with no Length attribute).
    const lm = (p.attrs?.Length ?? "").match(/(\d{2,4})/) ?? p.name.match(/\b(\d{2,4})\s*m\b/);
    const len = lm ? +lm[1] : 90;
    if (!LENGTHS.includes(len)) continue;
    const price = Number(p.elume_price);
    if (price > 0) cands.push({ size, len, price, perM: price / len, who: `${p.brand} ${p.name}` });
  }
  // Outlier guard: a stale legacy row (e.g. a seed price double the market)
  // must not become the anchor. Per size, reject candidates whose per-metre
  // price is far off the median per-metre across that size's candidates.
  const best = new Map();
  for (const size of SIZES) {
    const ofSize = cands.filter((c) => c.size === size);
    if (!ofSize.length) continue;
    const perMs = ofSize.map((c) => c.perM).sort((a, b) => a - b);
    const median = perMs[Math.floor(perMs.length / 2)];
    for (const c of ofSize) {
      if (c.perM > median * 1.6 || c.perM < median * 0.4) {
        console.log(`  anchor outlier dropped: ${c.who} (₹${c.price} / ${c.len} m = ₹${c.perM.toFixed(0)}/m vs median ₹${median.toFixed(0)}/m)`);
        continue;
      }
      const k = `${c.size}|${c.len}`;
      if (!best.has(k) || c.price > best.get(k).price) best.set(k, { price: c.price, who: c.who });
    }
  }
  return best;
}

function priceTable(best) {
  const out = new Map(); // "size|len" → { price, basis }
  for (const size of SIZES) {
    // 90 m base for the size
    let base90, basis90;
    const direct90 = best.get(`${size}|90`);
    if (direct90) { base90 = direct90.price; basis90 = `1.5x ${direct90.who}`; }
    else if (size === 10) {
      const six = best.get("6|90");
      base90 = six.price * 1.6;
      basis90 = `1.5x (1.6x the 6 sq mm anchor: ${six.who})`;
    } else {
      throw new Error(`No 90 m anchor for ${size} sq mm`);
    }
    for (const len of LENGTHS) {
      const direct = best.get(`${size}|${len}`);
      if (direct) {
        out.set(`${size}|${len}`, { price: round50(direct.price * 1.5), basis: `1.5x ${direct.who}` });
      } else {
        const factor = len === 90 ? 1 : len === 45 ? 0.5 : 1.95;
        out.set(`${size}|${len}`, { price: round50(base90 * factor * 1.5), basis: `${basis90}${len !== 90 ? ` x${factor} for ${len} m` : ""}` });
      }
    }
  }
  return out;
}

/* ── the listing ── */
const TECH = (len) => ({
  line: "Elume FR",
  conductor: { material: "bright annealed electrolytic copper (IS 8130)", class: "5" },
  insulation: { material: "FR PVC, flame retardant, self-extinguishing" },
  voltage_grade_v: 1100,
  standards: ["IS 694", "IS 8130", "RoHS"],
  fire_tests: [
    { test: "Critical Oxygen Index", method: "ASTM D2863", value: "Above standard PVC" },
    { test: "Smoke Density", method: "ASTM D2843", value: "Low smoke" },
    { test: "High-voltage spark test", method: "Every batch", value: "100% of production" },
  ],
  packing: `${len} m coil, rigid printed carton`,
  colours: COLOURS.map((c) => c.name),
  source: "Elume engineering specification",
});

async function main() {
  const best = await anchors();
  const prices = priceTable(best);

  console.log("Pricing basis (per size, 90 m):");
  for (const size of SIZES) console.log(`  ${String(size).padEnd(5)} 45m ₹${prices.get(`${size}|45`).price}  90m ₹${prices.get(`${size}|90`).price}  180m ₹${prices.get(`${size}|180`).price}  · ${prices.get(`${size}|90`).basis.slice(0, 80)}`);

  const rows = [];
  const parentId = "elume-fr-2p5-90-ultraviolet"; // the signature spec: 2.5 sq mm · 90 m · Ultraviolet
  for (const size of SIZES) {
    for (const len of LENGTHS) {
      for (const c of COLOURS) {
        const id = `elume-fr-${sizeSlug(size)}-${len}-${c.name.toLowerCase().replace(/\s+/g, "-")}`;
        const sku = `ELM-FR-${size}-${len}-${c.name.toUpperCase().replace(/\s+/g, "")}`;
        const { price } = prices.get(`${size}|${len}`);
        const name = `Elume FR House Wire ${size} sq mm — ${c.name}${len !== 90 ? ` · ${len} m` : ""}`;
        const spec = `Elume FR · ${size} sq mm · single core · class-5 flexible copper (IS 8130) · ${len} m coil · FR PVC, self-extinguishing · 1100 V · IS 694 · ${c.name} (${c.real})`;
        const attrs = { Size: `${size} sq mm`, Length: `${len} m`, Colour: c.name };
        rows.push(`(${q(id)}, ${q(sku)}, ${q(name)}, 'Elume', 'Wires & Cables', ${q(spec)}, ${price}, ${price}, 'coil', '/elume/box-front-white.jpg', ${jsonb(attrs)}, ${q(sku)}, ${id === parentId ? "null" : q(parentId)}, ${jsonb(TECH(len))}, true, true, -10)`);
  } } }

  // Parent must be first for the self-referencing FK within one statement set.
  rows.sort((a, b) => (a.startsWith(`('${parentId}'`) ? -1 : b.startsWith(`('${parentId}'`) ? 1 : 0));

  const sql = `-- ═══════════════════════════════════════════════════════════════
-- 0049 · Elume FR House Wire — the house label (generated by
-- scripts/gen-elume-wire.mjs; rerun to re-derive prices from the catalogue)
--
-- ${rows.length} SKUs: ${SIZES.length} sizes x ${LENGTHS.length} lengths x ${COLOURS.length} colours, one variant
-- family (parent: 2.5 sq mm · 90 m · Ultraviolet). Priced at 1.5x the highest
-- comparable on our own catalogue per size+length (derived where no direct
-- comparable exists; see the script header). MRP equals the price by design:
-- the price is the price. sort_order -10 leads every shelf;
-- is_recommended = true.
-- ═══════════════════════════════════════════════════════════════

insert into public.products (id, sku, name, brand, category, spec, mrp, elume_price, unit, image_url, attrs, brand_sku, parent_id, tech_specs, is_active, is_recommended, sort_order) values
${rows.join(",\n")}
on conflict (id) do update set
  mrp = excluded.mrp,
  elume_price = excluded.elume_price,
  spec = excluded.spec,
  attrs = excluded.attrs,
  tech_specs = excluded.tech_specs,
  image_url = excluded.image_url,
  sort_order = excluded.sort_order;
`;
  writeFileSync(path.join(ROOT, "supabase/migrations/0049_elume-house-wire.sql"), sql);
  console.log(`\n0049 written: ${rows.length} SKUs.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
