/**
 * Monthly MULTI-SOURCE competitor price sync. For every ENABLED source in
 * competitor_sources that has a fetcher here, refetches each mapped product's
 * live price, writes a ₹1-under suggestion + a history row (per-product chart).
 *   node --env-file=.env.local scripts/competitor-sync.mjs
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Optional: VASHI_PINCODE (default 400001).
 *
 * Mirrors src/lib/admin/competitor-sync.ts + the adapters in src/lib/competitors/.
 * All Tier-1 feeds are public (no login): Vashi OCC (pincode header), Crompton
 * (Shopify JSON), Legrand/Havells (Magento GraphQL).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const PINCODE = (process.env.VASHI_PINCODE || "400001").trim();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => { if (v == null) return null; const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v); return Number.isFinite(n) ? n : null; };

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)) { console.error(`SUPABASE_URL looks wrong: "${SUPABASE_URL}".`); process.exit(1); }

let db;
try { db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }
catch (e) { console.error("Bad Supabase client:", e.message || e); process.exit(1); }

/* ── Per-platform fetchers: fetchByCode(code) → { code,name,listPrice,netPrice,url,inStock } ── */

async function vashiFetch(code) {
  const OCC = "https://prodapi.vashiisl.com/occ/v2/visl";
  const HDRS = { "User-Agent": UA, Accept: "application/json", "X-Custom-Country": "IN", "X-Custom-Pincode": PINCODE, "X-Custom-Dealer": "" };
  try {
    const r = await fetch(`${OCC}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`, { headers: HDRS });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.code) return null;
    const price = d.price ?? {};
    const list = num(price.mrp ?? price.mrpValue);
    const value = num(price.value ?? price.sellingPrice);
    const net = value != null && list != null && value < list ? value : null;
    const rel = typeof d.url === "string" ? d.url : null;
    return { code: String(d.code), name: String(d.name ?? ""), listPrice: list ?? value, netPrice: net, url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null, inStock: d.stock?.stockLevelStatus ? d.stock.stockLevelStatus !== "outOfStock" : null };
  } catch { return null; }
}

function shopifyFetch(base) {
  const b = base.replace(/\/+$/, "");
  return async (handle) => {
    try {
      const r = await fetch(`${b}/products/${encodeURIComponent(handle)}.json`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) return null;
      const p = (await r.json())?.product;
      if (!p) return null;
      const variants = p.variants ?? [];
      const v = variants[0] ?? {};
      const selling = num(v.price);
      const mrp = num(v.compare_at_price); // "0.00" when no MRP set → treat as absent
      return { code: String(p.handle ?? handle), name: String(p.title ?? ""), listPrice: mrp && mrp > 0 ? mrp : selling, netPrice: selling, url: `${b}/products/${p.handle ?? handle}`, inStock: variants.length ? variants.some((x) => x.available !== false) : null };
    } catch { return null; }
  };
}

function magentoFetch(base) {
  const b = base.replace(/\/+$/, "");
  const FIELDS = "items{sku name url_key stock_status price_range{minimum_price{regular_price{value} final_price{value}}}}";
  return async (sku) => {
    try {
      const q = `query{products(filter:{sku:{eq:${JSON.stringify(sku)}}}){${FIELDS}}}`;
      const r = await fetch(`${b}/graphql?query=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "application/json", Store: "default" } });
      if (!r.ok) return null;
      const it = (await r.json())?.data?.products?.items?.[0];
      if (!it) return null;
      const mp = it.price_range?.minimum_price ?? {};
      const regular = num(mp.regular_price?.value);
      const final = num(mp.final_price?.value);
      return { code: String(it.sku ?? sku), name: String(it.name ?? ""), listPrice: regular ?? final, netPrice: final, url: it.url_key ? `${b}/${it.url_key}` : null, inStock: it.stock_status ? it.stock_status === "IN_STOCK" : null };
    } catch { return null; }
  };
}

// Which sources this cron can fetch (must match src/lib/competitors + DB ids).
const FETCHERS = {
  vashi: vashiFetch,
  crompton: shopifyFetch("https://www.crompton.co.in"),
  legrand: magentoFetch("https://shop.legrand.co.in"),
  havells: magentoFetch("https://havells.com"),
};

/* ── Sync one source (same logic as the admin runCompetitorSync) ── */
async function syncSource(source, products, priceById) {
  const fetchByCode = FETCHERS[source];
  const mapsRes = await db.from("competitor_map").select("product_id, competitor_code, unit_factor").eq("source", source);
  if (mapsRes.error) { console.warn(`  [${source}] competitor_map read failed: ${mapsRes.error.message}`); return; }
  const maps = mapsRes.data ?? [];
  if (maps.length === 0) { console.log(`  [${source}] no products mapped — skipping.`); await db.from("competitor_sync_log").insert({ source, mapped: 0, fetched: 0, failed: 0, suggestions: 0, run_source: "cron" }); return; }

  const prevRes = await db.from("competitor_prices").select("product_id, comparable_price, status").eq("source", source);
  const prevById = new Map((prevRes.data ?? []).map((r) => [r.product_id, { comparable: r.comparable_price, status: r.status }]));

  let fetched = 0, failed = 0, suggestions = 0;
  const nowIso = new Date().toISOString();
  console.log(`  [${source}] syncing ${maps.length} mapped products…`);

  for (const m of maps) {
    const item = await fetchByCode(m.competitor_code);
    const effective = item ? (item.netPrice ?? item.listPrice) : null;
    if (!item || effective == null) { failed++; console.warn(`    ✗ ${m.product_id} (${m.competitor_code})`); await sleep(250); continue; }
    fetched++;

    const factor = Number(m.unit_factor) || 1;
    const comparable = Math.round(effective * factor * 100) / 100;
    const suggested = Math.max(1, Math.round(comparable) - 1);
    const ourPrice = priceById.get(m.product_id) ?? null;

    const before = prevById.get(m.product_id);
    const unchanged = before && before.comparable != null && Math.abs(Number(before.comparable) - comparable) < 0.005;
    let status = "pending";
    if (unchanged && (before.status === "accepted" || before.status === "dismissed")) status = before.status;
    if (status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested) suggestions++;

    await db.from("competitor_prices").upsert({
      product_id: m.product_id, source, competitor_code: item.code, competitor_name: item.name, competitor_url: item.url,
      list_price: item.listPrice, net_price: item.netPrice, unit_factor: factor, comparable_price: comparable,
      suggested_price: suggested, our_price: ourPrice, status, in_stock: item.inStock, fetched_at: nowIso,
    });
    await db.from("competitor_price_history").insert({
      product_id: m.product_id, source, list_price: item.listPrice, net_price: item.netPrice, comparable_price: comparable, our_price: ourPrice, captured_at: nowIso,
    });
    console.log(`    ✓ ${m.product_id}: ${item.netPrice != null ? "net" : "list"} ₹${effective}×${factor}=₹${comparable} → suggest ₹${suggested} (ours ₹${ourPrice ?? "?"})`);
    await sleep(300);
  }

  await db.from("competitor_sync_log").insert({ source, mapped: maps.length, fetched, failed, suggestions, run_source: "cron" });
  console.log(`  [${source}] done. fetched=${fetched} failed=${failed} suggestions=${suggestions}`);
}

async function main() {
  const productsRes = await db.from("products").select("id, elume_price");
  if (productsRes.error) { console.error(`Reading products failed: ${productsRes.error.message} — is SUPABASE_SERVICE_ROLE_KEY the service-role key?`); process.exit(1); }
  const products = productsRes.data ?? [];
  const priceById = new Map(products.map((p) => [p.id, Number(p.elume_price)]));

  // Enabled sources from the registry that this cron knows how to fetch.
  const srcRes = await db.from("competitor_sources").select("id, enabled").eq("enabled", true).order("sort_order");
  if (srcRes.error) { console.error(`Reading competitor_sources failed: ${srcRes.error.message}. Run supabase/migrations/0012_competitor-pricing.sql first.`); process.exit(1); }
  const sources = (srcRes.data ?? []).map((s) => s.id).filter((id) => FETCHERS[id]);
  const skipped = (srcRes.data ?? []).map((s) => s.id).filter((id) => !FETCHERS[id]);
  if (skipped.length) console.log(`Enabled but no cron fetcher (skipping): ${skipped.join(", ")}`);
  if (sources.length === 0) { console.log("No enabled+fetchable sources. Enable one in competitor_sources."); return; }

  console.log(`Syncing sources: ${sources.join(", ")}`);
  for (const source of sources) await syncSource(source, products, priceById);
  console.log("All sources done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
