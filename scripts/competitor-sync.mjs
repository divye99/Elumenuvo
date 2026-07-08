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
import { FETCHERS } from "./lib/competitor-fetchers.mjs";

// @supabase/supabase-js initialises a realtime client that needs a global
// WebSocket (native on Node 22+, absent on Node 20). We never use realtime —
// polyfill it from `ws` when missing so createClient works on any runner.
if (typeof globalThis.WebSocket === "undefined") {
  try { globalThis.WebSocket = (await import("ws")).default; } catch { /* native WS present, or ws unavailable */ }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)) { console.error(`SUPABASE_URL looks wrong: "${SUPABASE_URL}".`); process.exit(1); }

let db;
try { db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }
catch (e) { console.error("Bad Supabase client:", e.message || e); process.exit(1); }

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
