#!/usr/bin/env node
/**
 * Syska (Dukaan storefront) scrape + import generator → 0103_syska-import.sql
 *
 * syska.co.in is a small D2C store (38 products in the sitemap) and its search
 * API 502s, so this reads each product page's server-rendered __DUKAAN_DATA__
 * blob directly - the same source the sync adapter (makeDukaanAdapter) uses.
 * Scope: the electrical FMEG subset only - LED bulbs, emergency bulb, smart
 * bulbs, extension boards. Audio, wearables, chargers, torches and personal
 * care stay out. brand_sku = Dukaan slug (the adapter's competitor code).
 */
import { writeFile } from "node:fs/promises";

const SLUGS = {
  Lighting: [
    "syska-10-w-t-bulb-b22-led-bulb-white",
    "syska-12-w-t-bulb-b22-led-bulb-white",
    "syska-26-w-standard-b22-led-bulb-white",
    "syska-30-w-t-bulb-b22-led-bulb-white",
    "syska-5-w-candle-e14-led-bulb-white",
    "syska-9-w-standard-b22-inverter-bulb-white",
    "syska-smart-bulb-smart-pumpkin-bulb-for-home-smart-led-bulb-with-music-sync-for-amazon-alexa-google",
    "syska-srl-12-w-standard-b22-led-bulb-with-free-2-aa-battery-white",
    "syska-srl-12-w-standard-b22-led-bulb-with-free-3-aa-battery-white-pack-of-3",
    "syska-srl-12-w-standard-b22-led-bulb-with-free-4-aa-battery-white-pack-of-4",
    "syska-srl-9-w-standard-b22-led-bulb-with-free-2-aa-battery-white-1",
    "syska-ssk-emb-1502-d-4-hrs-bulb-emergency-light-white",
    "syska-ssk-smw-8w-c-with-multicolor-android-ios-energy-efficient-and-eco-friendly-b22d",
  ],
  "Extension Boards": [
    "syska-ebs-0401a-4-way-power-strip-4-socket-extension-boards-white-2-m",
    "syska-pw-0301-universal-sockets-power-wheel-1500-watt-240v-and-4m-cord-length-extension-board-with-s-2",
  ],
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const esc = (s) => String(s).replace(/'/g, "''");
const strip = (s) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const rows = [];
let i = 0;
for (const [cat, slugs] of Object.entries(SLUGS)) {
  for (const slug of slugs) {
    const res = await fetch(`https://syska.co.in/products/${slug}`, { headers: { "User-Agent": UA } });
    if (!res.ok) { console.error(`SKIP ${slug}: HTTP ${res.status}`); continue; }
    const html = await res.text();
    const m = html.match(/id="__DUKAAN_DATA__">([\s\S]*?)<\/script>/);
    if (!m) { console.error(`SKIP ${slug}: no __DUKAAN_DATA__`); continue; }
    let p;
    try { p = JSON.parse(m[1])?.DUKAAN_PRODUCT; } catch { p = null; }
    if (!p) { console.error(`SKIP ${slug}: no DUKAAN_PRODUCT`); continue; }

    const price = Number(p.selling_price);
    const mrpRaw = Number(p.original_price ?? 0);
    if (!Number.isFinite(price) || price <= 300 || price > 50000) { console.error(`SKIP ${slug}: price ${price}`); continue; }
    if (p.in_stock === false) { console.error(`SKIP ${slug}: out of stock`); continue; }
    const mrp = Math.max(mrpRaw, price);
    const elume = Math.round(price * 0.98);
    const img = (p.images?.[0]?.photo_url ?? p.image ?? "").split("?")[0] || null;
    const name = strip(p.name).slice(0, 140);
    const spec = strip(p.description).slice(0, 400) || name;
    const sku = (name.match(/\b([A-Z]{2,4}-?\d{3,6}[A-Z]*)\b/) ?? [])[1] ?? slug.slice(6, 40);
    const id = `sys-${slug.replace(/^syska-/, "").replace(/[^a-z0-9]+/g, "-")}`.slice(0, 60);

    rows.push(
      `  ('${id}', '${esc(sku)}', '${esc(slug)}', '${esc(name)}', 'Syska', '${cat}', '${esc(spec)}', ${mrp}, ${elume}, 'pc', ${img ? `'${esc(img)}'` : "null"}, true, true, ${15000 + i++})`
    );
    console.error(`OK ${slug}: Rs ${price} (MRP ${mrp})${img ? "" : " NO IMAGE"}`);
    await new Promise((r) => setTimeout(r, 350));
  }
}

const sql = `-- 0103: Syska import - the electrical FMEG subset of syska.co.in (Dukaan D2C
-- store; only ${rows.length} of its 38 products are in scope - the rest is audio,
-- wearables and personal care). Scraped ${new Date().toISOString().slice(0, 10)} from each product
-- page's __DUKAAN_DATA__. Pricing: selling price -2%; MRP = original_price.
-- brand_sku = Dukaan slug (the Syska sync adapter's competitor code).
-- After running: "Rebuild mappings now" in /admin/compare.
insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, in_stock, sort_order)
values
${rows.join(",\n")}
on conflict (id) do nothing;

-- Syska as an own-brand price source (auto-map by slug + auto-apply Rs 1 under).
insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order)
  values ('syska', 'Syska', 'https://syska.co.in', true, false, 16)
  on conflict (id) do update set enabled = true, site_url = excluded.site_url;
`;
await writeFile("supabase/migrations/0103_syska-import.sql", sql);
console.log(JSON.stringify({ rows: rows.length }));
