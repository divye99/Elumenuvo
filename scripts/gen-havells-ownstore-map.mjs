#!/usr/bin/env node
/**
 * Generate 0043: EXACT Havells own-store mappings + first price snapshots.
 *
 *   node --env-file=.env.local scripts/gen-havells-ownstore-map.mjs
 *
 * Layer 1 of the pricing intelligence at full strength: on the brand's own
 * store there is nothing to search or fuzzy-match, because the import gave
 * every product the manufacturer's exact per-variant SKU, page URL, selling
 * price, MRP and stock state. This emits, for every Havells product:
 *
 *   competitor_map    source='havells', competitor_code=brand_sku,
 *                     match_method='brand-sku', approval='approved'
 *   competitor_prices list=MRP, comparable=selling price, in_stock,
 *                     status mirroring src/lib/admin/competitor-sync.ts
 *                     ('unavailable' when not buyable), suggested=comparable-1
 *
 * Product ids come from three places (highest precedence first) so the file
 * covers rows the user has not imported yet: part7 brand_sku updates, the
 * 0041 insert tuples, then the live DB.
 *
 * MUST RUN AFTER all 0041 parts (FK on product_id).
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIG = path.join(ROOT, "supabase/migrations");
const DATA = JSON.parse(readFileSync(path.join(ROOT, "scripts/data/havells-catalogue.json"), "utf8"));

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
if (!SUPABASE_URL || !ANON) { console.error("Missing env (use --env-file=.env.local)"); process.exit(1); }

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const norm = (s) => String(s || "").trim().toUpperCase();

/* ── site data: normalized SKU → listing facts ── */
const site = new Map();
for (const p of DATA.products) {
  const baseUrl = `https://havells.com/${p.url_key}.html`;
  const variants = (p.variants ?? []).filter((v) => v?.product?.sku);
  if (variants.length) {
    for (const v of variants) {
      const colorIdx = v.attributes?.find((a) => a.code === "color")?.value_index;
      site.set(norm(v.product.sku), {
        name: v.product.name || p.name,
        url: colorIdx != null ? `${baseUrl}?color=${colorIdx}` : baseUrl,
        final: v.product.price_range?.minimum_price?.final_price?.value ?? null,
        mrp: v.product.price_range?.minimum_price?.regular_price?.value ?? null,
        inStock: v.product.stock_status === "IN_STOCK",
      });
    }
  }
  if (!site.has(norm(p.sku))) {
    site.set(norm(p.sku), {
      name: p.name,
      url: baseUrl,
      final: p.price_range?.minimum_price?.final_price?.value ?? null,
      mrp: p.price_range?.minimum_price?.regular_price?.value ?? null,
      inStock: p.stock_status === "IN_STOCK",
    });
  }
}

/* ── product ids: 0041 tuples + part7 updates + live DB ── */
const rows = new Map(); // id → { sku, ourPrice }
// live DB first (lowest precedence: overwritten by the generated files below)
const dbRows = [];
for (let from = 0; ; from += 1000) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,brand_sku,elume_price&brand=eq.Havells&order=id&limit=1000&offset=${from}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const page = await r.json();
  dbRows.push(...page);
  if (page.length < 1000) break;
}
for (const p of dbRows) if (p.brand_sku) rows.set(p.id, { sku: p.brand_sku, ourPrice: Math.round(Number(p.elume_price)) });

// 0041 insert tuples: id (col 1), sku (col 2, = brand_sku), elume_price (col 8)
for (const f of readdirSync(MIG).filter((f) => /^0041_havells-import-part\d+\.sql$/.test(f)).sort()) {
  const sql = readFileSync(path.join(MIG, f), "utf8");
  for (const m of sql.matchAll(/\n\('([^']+)', '([^']+)', '(?:[^']|'')*', 'Havells', '[^']+', (?:'(?:[^']|'')*'|null), \d+, (\d+),/g)) {
    rows.set(m[1], { sku: m[2], ourPrice: Number(m[3]) });
  }
  // part7 refreshes existing rows to their per-colour SKU
  for (const m of sql.matchAll(/update public\.products set [^;]*brand_sku = '([^']+)'[^;]*where id = '([^']+)';/g)) {
    const prev = rows.get(m[2]);
    rows.set(m[2], { sku: m[1], ourPrice: prev?.ourPrice ?? null });
  }
}

/* ── emit ── */
const nowIso = DATA.scrapedAt;
const maps = [], prices = [];
let missing = 0;
for (const [id, r] of [...rows.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const s = site.get(norm(r.sku));
  if (!s) { missing++; continue; } // pruned/absent products have no listing
  maps.push(`(${q(id)}, 'havells', ${q(r.sku)}, ${q(s.url)}, 1, 'own store · exact MPN from catalogue import', 'brand-sku', 'approved', 'New')`);
  const buyable = s.inStock && s.final != null && s.final > 0;
  const comparable = buyable ? Math.round(s.final * 100) / 100 : null;
  const suggested = buyable ? Math.max(1, Math.round(comparable) - 1) : null;
  prices.push(`(${q(id)}, 'havells', ${q(r.sku)}, ${q(s.name)}, ${q(s.url)}, ${s.mrp ?? "null"}, null, 1, ${comparable ?? "null"}, ${suggested ?? "null"}, ${r.ourPrice ?? "null"}, ${buyable ? "'pending'" : "'unavailable'"}, ${s.inStock}, 'INR', ${q(nowIso)})`);
}

const sql = `-- ═══════════════════════════════════════════════════════════════
-- 0043 · Havells own-store mappings + first price snapshots
-- Generated by scripts/gen-havells-ownstore-map.mjs from the ${nowIso} scrape.
--
-- Layer 1 (brand SKU) needs no matching on the brand's own store: the import
-- carries the exact per-variant MPN, URL, price, MRP and stock. Every Havells
-- product is mapped match_method='brand-sku', approval='approved', and seeded
-- with a price snapshot so Price Radar is populated immediately; the normal
-- "Refresh prices" sync keeps them current afterwards.
--
-- RUN AFTER ALL 0041 PARTS AND 0042 (foreign key on product_id; pruned rows
-- must be gone or their mapping insert would resurrect stale intelligence).
-- Idempotent: upserts on (product_id, source).
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_map (product_id, source, competitor_code, competitor_url, unit_factor, note, match_method, approval, item_condition) values
${maps.join(",\n")}
on conflict (product_id, source) do update set
  competitor_code = excluded.competitor_code,
  competitor_url  = excluded.competitor_url,
  unit_factor     = excluded.unit_factor,
  note            = excluded.note,
  match_method    = 'brand-sku',
  approval        = 'approved',
  updated_at      = now();

insert into public.competitor_prices (product_id, source, competitor_code, competitor_name, competitor_url, list_price, net_price, unit_factor, comparable_price, suggested_price, our_price, status, in_stock, currency, fetched_at) values
${prices.join(",\n")}
on conflict (product_id, source) do update set
  competitor_code  = excluded.competitor_code,
  competitor_name  = excluded.competitor_name,
  competitor_url   = excluded.competitor_url,
  list_price       = excluded.list_price,
  unit_factor      = excluded.unit_factor,
  comparable_price = excluded.comparable_price,
  suggested_price  = excluded.suggested_price,
  our_price        = excluded.our_price,
  status           = excluded.status,
  in_stock         = excluded.in_stock,
  fetched_at       = excluded.fetched_at;
`;

writeFileSync(path.join(MIG, "0043_havells-ownstore-map.sql"), sql);
console.log(`0043 written: ${maps.length} mappings + ${prices.length} snapshots (${missing} ids had no live listing, correctly skipped).`);
const oos = prices.filter((p) => p.includes("'unavailable'")).length;
console.log(`Snapshots: ${prices.length - oos} buyable, ${oos} unavailable.`);
