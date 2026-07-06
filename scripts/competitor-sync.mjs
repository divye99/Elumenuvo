/**
 * Monthly competitor price sync (Vashi). Logs in with a Vashi B2B account (if
 * credentials are set) to read the real net price, refetches every mapped
 * product's price, writes ₹1-under suggestions + a history row (for the
 * per-product price chart). Run by the GitHub Action monthly, or manually:
 *   node --env-file=.env.local scripts/competitor-sync.mjs
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Optional (unlocks net price): VASHI_USERNAME + VASHI_PASSWORD.
 *
 * Mirrors src/lib/admin/competitor-sync.ts + src/lib/competitors/vashi.ts.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const V_USER = (process.env.VASHI_USERNAME || "").trim();
const V_PASS = (process.env.VASHI_PASSWORD || "").trim();
const V_CLIENT_ID = (process.env.VASHI_CLIENT_ID || "mobile_android").trim();
const V_CLIENT_SECRET = (process.env.VASHI_CLIENT_SECRET || "vislsecret").trim();
const SOURCE = "vashi";
const BASE = "https://prodapi.vashiisl.com";
const OCC = `${BASE}/occ/v2/visl`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)) { console.error(`SUPABASE_URL looks wrong: "${SUPABASE_URL}".`); process.exit(1); }

let db;
try { db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } }); }
catch (e) { console.error("Bad Supabase client:", e.message || e); process.exit(1); }

const num = (v) => { if (v == null) return null; const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v); return Number.isFinite(n) ? n : null; };

async function login() {
  if (!V_USER || !V_PASS) { console.log("No VASHI_USERNAME/PASSWORD — using public list prices only."); return null; }
  const body = new URLSearchParams({ grant_type: "password", client_id: V_CLIENT_ID, client_secret: V_CLIENT_SECRET, username: V_USER, password: V_PASS });
  try {
    const r = await fetch(`${BASE}/authorizationserver/oauth/token`, { method: "POST", headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body });
    if (!r.ok) { console.warn(`Vashi login failed (HTTP ${r.status}) — falling back to list prices.`); return null; }
    const d = await r.json();
    console.log("Logged in to Vashi — reading net prices.");
    return d.access_token ?? null;
  } catch (e) { console.warn("Vashi login error:", e.message || e); return null; }
}

async function fetchByCode(code, token) {
  const h = { "User-Agent": UA, Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`${OCC}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`, { headers: h });
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.code) return null;
    const price = d.price ?? {};
    const list = num(price.mrp ?? price.mrpValue ?? price.value);
    const selling = num(price.value ?? price.sellingPrice);
    const net = selling != null && list != null && selling < list ? selling : null;
    const rel = typeof d.url === "string" ? d.url : null;
    return { code: String(d.code), name: String(d.name ?? ""), listPrice: list ?? selling, netPrice: net, url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null, inStock: d.stock?.stockLevelStatus ? d.stock.stockLevelStatus !== "outOfStock" : null };
  } catch { return null; }
}

async function main() {
  const mapsRes = await db.from("competitor_map").select("product_id, competitor_code, unit_factor").eq("source", SOURCE);
  if (mapsRes.error) { console.error(`Reading competitor_map failed: ${mapsRes.error.message}. Run supabase/competitor-pricing-v2.sql first.`); process.exit(1); }
  const productsRes = await db.from("products").select("id, elume_price");
  if (productsRes.error) { console.error(`Reading products failed: ${productsRes.error.message} — is SUPABASE_SERVICE_ROLE_KEY the service-role key?`); process.exit(1); }
  const prevRes = await db.from("competitor_prices").select("product_id, comparable_price, status").eq("source", SOURCE);

  const maps = mapsRes.data ?? [];
  if (maps.length === 0) {
    console.log("No products mapped for Vashi. Map them in /admin/radar (or run supabase/competitor-map-seed.sql), then re-run.");
    await db.from("competitor_sync_log").insert({ source: SOURCE, mapped: 0, fetched: 0, failed: 0, suggestions: 0, run_source: "cron" });
    return;
  }

  const token = await login();
  const priceById = new Map((productsRes.data ?? []).map((p) => [p.id, Number(p.elume_price)]));
  const prevById = new Map((prevRes.data ?? []).map((r) => [r.product_id, { comparable: r.comparable_price, status: r.status }]));

  let fetched = 0, failed = 0, suggestions = 0;
  const nowIso = new Date().toISOString();
  console.log(`Syncing ${maps.length} mapped products…`);

  for (const m of maps) {
    const item = await fetchByCode(m.competitor_code, token);
    const effective = item ? (item.netPrice ?? item.listPrice) : null;
    if (!item || effective == null) { failed++; console.warn(`  ✗ ${m.product_id} (${m.competitor_code})`); await sleep(250); continue; }
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
      product_id: m.product_id, source: SOURCE, competitor_code: item.code, competitor_name: item.name, competitor_url: item.url,
      list_price: item.listPrice, net_price: item.netPrice, unit_factor: factor, comparable_price: comparable,
      suggested_price: suggested, our_price: ourPrice, status, in_stock: item.inStock, fetched_at: nowIso,
    });
    await db.from("competitor_price_history").insert({
      product_id: m.product_id, source: SOURCE, list_price: item.listPrice, net_price: item.netPrice, comparable_price: comparable, our_price: ourPrice, captured_at: nowIso,
    });
    console.log(`  ✓ ${m.product_id}: ${item.netPrice != null ? "net" : "list"} ₹${effective}×${factor}=₹${comparable} → suggest ₹${suggested} (ours ₹${ourPrice ?? "?"})`);
    await sleep(300);
  }

  await db.from("competitor_sync_log").insert({ source: SOURCE, mapped: maps.length, fetched, failed, suggestions, run_source: "cron" });
  console.log(`Done. fetched=${fetched} failed=${failed} suggestions=${suggestions}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
