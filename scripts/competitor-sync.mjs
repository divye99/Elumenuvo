/**
 * Monthly competitor price sync — refetches every mapped Vashi (vashiisl.com)
 * product's live price and writes ₹1-under suggestions to Supabase. Run by the
 * GitHub Action (.github/workflows/competitor-price-sync.yml) on a monthly cron,
 * and manually via `node --env-file=.env.local scripts/competitor-sync.mjs`.
 *
 * Needs env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 *
 * This mirrors src/lib/admin/competitor-sync.ts — keep the formula in sync
 * (comparable = vashi_price × unit_factor; suggested = round(comparable) − 1).
 */
import { createClient } from "@supabase/supabase-js";

// Trim — GitHub secrets often carry a trailing newline from copy-paste, which
// makes createClient throw "Invalid supabaseUrl".
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const VASHI_BASE = "https://prodapi.vashiisl.com/occ/v2/visl";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (set them as GitHub Action secrets).");
  process.exit(1);
}
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)) {
  console.error(`SUPABASE_URL looks wrong: "${SUPABASE_URL}". It should be just https://<project>.supabase.co (no path, no trailing slash).`);
  process.exit(1);
}

let db;
try {
  db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
} catch (e) {
  console.error("Could not create the Supabase client:", e instanceof Error ? e.message : e);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchVashiProduct(code) {
  const url = `${VASHI_BASE}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.code) return null;
    const rel = typeof d.url === "string" ? d.url : null;
    return {
      code: String(d.code),
      name: String(d.name ?? ""),
      price: typeof d.price?.value === "number" ? d.price.value : null,
      url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null,
      inStock: d.stock?.stockLevelStatus ? d.stock.stockLevelStatus !== "outOfStock" : null,
    };
  } catch {
    return null;
  }
}

function explainDbError(err, table) {
  if (!err) return;
  const msg = String(err.message || err);
  if (/relation .* does not exist|could not find the table|schema cache/i.test(msg)) {
    console.error(`Table "public.${table}" is missing. Run supabase/competitor-pricing.sql in the Supabase SQL Editor first.`);
  } else if (/JWT|api key|invalid.*key|permission denied/i.test(msg)) {
    console.error(`Supabase rejected the key while reading "${table}": ${msg}. Make sure SUPABASE_SERVICE_ROLE_KEY is the service-role key (not anon).`);
  } else {
    console.error(`Error reading "${table}": ${msg}`);
  }
  process.exit(1);
}

async function main() {
  const mapsRes = await db.from("competitor_map").select("product_id, vashi_code, unit_factor");
  explainDbError(mapsRes.error, "competitor_map");
  const productsRes = await db.from("products").select("id, elume_price");
  explainDbError(productsRes.error, "products");
  const prevRes = await db.from("competitor_prices").select("product_id, vashi_price, status");
  explainDbError(prevRes.error, "competitor_prices");
  const maps = mapsRes.data;
  const products = productsRes.data;
  const prev = prevRes.data;

  if (!maps || maps.length === 0) {
    console.log("No products mapped yet — nothing to sync. Map products in /admin/radar, then re-run.");
    await db.from("competitor_sync_log").insert({ mapped: 0, fetched: 0, failed: 0, suggestions: 0, source: "cron" });
    return;
  }

  const priceById = new Map((products ?? []).map((p) => [p.id, Number(p.elume_price)]));
  const prevById = new Map((prev ?? []).map((r) => [r.product_id, { vashi_price: r.vashi_price, status: r.status }]));

  const rows = maps ?? [];
  let fetched = 0, failed = 0, suggestions = 0;
  console.log(`Syncing ${rows.length} mapped products from Vashi…`);

  for (const m of rows) {
    const vp = await fetchVashiProduct(m.vashi_code);
    if (!vp || vp.price == null) { failed++; console.warn(`  ✗ ${m.product_id} (${m.vashi_code}) — no price`); await sleep(250); continue; }
    fetched++;

    const factor = Number(m.unit_factor) || 1;
    const comparable = Math.round(vp.price * factor * 100) / 100;
    const suggested = Math.max(1, Math.round(comparable) - 1);
    const ourPrice = priceById.get(m.product_id) ?? null;

    const before = prevById.get(m.product_id);
    const priceUnchanged = before && before.vashi_price != null && Math.abs(Number(before.vashi_price) - vp.price) < 0.005;
    let status = "pending";
    if (priceUnchanged && (before.status === "accepted" || before.status === "dismissed")) status = before.status;
    if (status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested) suggestions++;

    await db.from("competitor_prices").upsert({
      product_id: m.product_id,
      vashi_code: vp.code,
      vashi_name: vp.name,
      vashi_url: vp.url,
      vashi_price: vp.price,
      unit_factor: factor,
      comparable_price: comparable,
      suggested_price: suggested,
      our_price: ourPrice,
      status,
      in_stock: vp.inStock,
      fetched_at: new Date().toISOString(),
    });
    console.log(`  ✓ ${m.product_id}: Vashi ₹${vp.price}×${factor}=₹${comparable} → suggest ₹${suggested} (ours ₹${ourPrice ?? "?"})`);
    await sleep(300);
  }

  await db.from("competitor_sync_log").insert({ mapped: rows.length, fetched, failed, suggestions, source: "cron" });
  console.log(`Done. fetched=${fetched} failed=${failed} suggestions=${suggestions}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
