/**
 * Catalogue expansion from BestOfElectricals (nopCommerce, fully SSR'd).
 * Scrapes a brand's manufacturer pages (name, MRP = old-price, selling =
 * actual-price, image) and generates a migration that:
 *   1. inserts the new products (id boe<pid>, image hotlinked from their CDN),
 *   2. self-maps each one to the bestofelectricals source (instant price radar),
 *   3. seeds a price_history snapshot so charts work from day one.
 *
 *   node --env-file=.env.local scripts/import-boe-catalogue.mjs norisys
 *     → writes supabase/migrations/0021_catalogue-boe-norisys.sql
 *
 * Pricing rule: our price = their selling price − ₹1 (₹1-under strategy).
 * Dedupes against the live catalogue by normalized name (anon read).
 */
import fs from "fs";

const BRAND_ARG = (process.argv[2] || "norisys").toLowerCase();
const BRAND_LABEL = { norisys: "Norisys", havells: "Havells", legrand: "Legrand", anchor: "Anchor", polycab: "Polycab", finolex: "Finolex", philips: "Philips", wipro: "Wipro", usha: "Usha", abb: "ABB", kei: "KEI", "rr-kabel": "RR Kabel", hager: "Hager", schneider: "Schneider" }[BRAND_ARG] || BRAND_ARG;
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const BASE = "https://www.bestofelectricals.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// Category from the product name (BOE mixes types under one brand page).
function categoryOf(name) {
  const n = name.toLowerCase();
  if (/\b(mcb|rccb|rcbo|isolator|breaker|elcb|changeover|disconnector)\b/.test(n)) return "Switchgear";
  if (/\b(distribution board|\bdb\b|spn|tpn|enclosure)\b/.test(n)) return "DB & Panels";
  if (/(sq\s*mm|sqmm|\bcore\b|frls|cable|wire)/.test(n)) return "Wires & Cables";
  if (/\b(led|light|lamp|batten|panel light|bulb|downlight|flood|street)\b/.test(n)) return "Lighting";
  if (/\b(fan|bldc|exhaust)\b/.test(n)) return "Fans";
  return "Modular"; // switches, sockets, plates, dimmers, regulators, USB…
}

// "Norisys Cube C5110.01 6A One Way Switch" → sku "NRS-C5110.01", spec "Cube · 6A · One Way"
function skuOf(name, pid) {
  const code = (name.match(/\b([A-Z]\d{3,5}(?:\.\d{1,2})?)\b/i) || [])[1];
  const prefix = BRAND_LABEL.slice(0, 3).toUpperCase();
  return code ? `${prefix}-${code.toUpperCase()}` : `BOE-${pid}`;
}
function specOf(name) {
  return name.replace(new RegExp(`^${BRAND_LABEL}\\s+`, "i"), "").trim();
}

function parseTiles(html) {
  const items = [];
  for (const b of html.split(/<div class=["']?product-item["']? data-productid=/).slice(1)) {
    const pid = (b.match(/^(\d+)/) || [])[1];
    const chunk = b.slice(0, 4500);
    const t = chunk.match(/<h2 class=["']?product-title["']?>\s*<a href=["']?([^ >"']+)["']?[^>]*>([^<]+)<\/a>/);
    if (!t || !pid) continue;
    // NB: strip the currency marker BEFORE the numeric cleanup — "Rs. 70" would
    // otherwise survive as ".70" (the dot from "Rs.") and parse as 0.7.
    const money = (s) => { const n = Number((s || "").replace(/Rs\.?|₹|,|\s/gi, "")); return Number.isFinite(n) && n > 0 ? n : null; };
    const old = money((chunk.match(/price old-price["']?>([^<]+)</) || [])[1]);
    const actual = money((chunk.match(/price actual-price["']?>([^<]+)</) || [])[1]);
    const img = (chunk.match(/data-lazyloadsrc=["']?([^ >"']+)/) || [])[1] || null;
    if (!actual) continue;
    items.push({
      pid,
      slug: t[1].replace(/^\//, ""),
      name: t[2].trim().replace(/\s+/g, " "),
      mrp: old && old > actual ? old : actual,
      selling: actual,
      image: img ? img.replace(/_\d+\.(jpe?g|png|webp)$/i, ".$1") : null, // full-size = no size suffix
    });
  }
  return items;
}

async function main() {
  // Existing names for dedupe (public read).
  let existing = new Set();
  if (SUPABASE_URL && ANON) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name&limit=2000`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const rows = await r.json();
    if (Array.isArray(rows)) existing = new Set(rows.map((p) => p.name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  }

  // Page through the manufacturer listing until a page repeats/empties.
  const all = new Map();
  for (let page = 1; page <= 60; page++) {
    const r = await fetch(`${BASE}/${BRAND_ARG}?pagenumber=${page}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) break;
    const items = parseTiles(await r.text());
    const before = all.size;
    for (const it of items) all.set(it.pid, it);
    process.stdout.write(`  page ${page}: +${all.size - before} (total ${all.size})\n`);
    if (all.size === before || items.length === 0) break; // no new items → done
    await sleep(350);
  }

  const fresh = [...all.values()].filter((it) => !existing.has(it.name.toLowerCase().replace(/[^a-z0-9]/g, "")));
  console.log(`\nScraped ${all.size} ${BRAND_LABEL} products; ${fresh.length} new after dedupe.`);

  const lines = [
    "-- ═══════════════════════════════════════════════════════════════",
    `-- Catalogue expansion: ${BRAND_LABEL} from BestOfElectricals (generated by`,
    "-- scripts/import-boe-catalogue.mjs). Idempotent. Includes: products +",
    "-- competitor_map self-mappings (instant price radar) + price_history seed.",
    `-- ${fresh.length} products. Our price = BOE selling − ₹1; MRP = BOE MRP.`,
    "-- ═══════════════════════════════════════════════════════════════",
    "",
  ];
  fresh.forEach((it, i) => {
    const id = `boe${it.pid}`;
    const ourPrice = Math.max(1, Math.round(it.selling) - 1);
    lines.push(
      `insert into public.products (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order, is_active, image_url) values (` +
        [q(id), q(skuOf(it.name, it.pid)), q(it.name), q(BRAND_LABEL), q(categoryOf(it.name)), q(specOf(it.name)), Math.round(it.mrp), ourPrice, q("pc"), 500 + i, "true", it.image ? q(it.image) : "null"].join(", ") +
        `)\n  on conflict (id) do update set name = excluded.name, mrp = excluded.mrp, elume_price = excluded.elume_price, image_url = excluded.image_url;`,
      `insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values (${q(id)}, 'bestofelectricals', ${q(it.slug)}, 1, 'imported from BOE')\n  on conflict (product_id, source) do nothing;`,
      `insert into public.price_history (product_id, elume_price, mrp) select ${q(id)}, ${ourPrice}, ${Math.round(it.mrp)} where not exists (select 1 from public.price_history where product_id = ${q(id)});`,
      ""
    );
  });
  lines.push(`select '${BRAND_LABEL} imported' as status, count(*) from public.products where brand = ${q(BRAND_LABEL)};`, "");

  const out = `supabase/migrations/0021_catalogue-boe-${BRAND_ARG}.sql`;
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out} (${fresh.length} products + mappings + history seeds).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
