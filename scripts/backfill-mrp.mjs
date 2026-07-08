/**
 * ONE-TIME MRP backfill. For every product mapped to a competitor source, fetch
 * the source's NON-DISCOUNTED (list/MRP) price, scale by the mapping's
 * unit_factor, and set our products.mrp to that. NOT a recurring job — run it
 * once to correct the current price list.
 *
 *   node --env-file=.env.local scripts/backfill-mrp.mjs           # dry run: report + write scripts/out/mrp-backfill.sql
 *   node --env-file=.env.local scripts/backfill-mrp.mjs --apply   # also write products.mrp directly
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
 * (needed to read competitor_map + write products). Optional VASHI_PINCODE.
 *
 * Rules:
 *  • MRP candidate = round(source.listPrice × unit_factor).
 *  • When a product is mapped to several sources, prefer a manufacturer-direct
 *    site (Crompton/Havells/Legrand/Syska) over a marketplace, then take the
 *    highest candidate (MRP is the ceiling).
 *  • Guardrail: never set MRP below our own elume_price — flagged & skipped.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { FETCHERS, BRAND_DIRECT } from "./lib/competitor-fetchers.mjs";

// supabase-js needs a global WebSocket (native on Node 22+; absent on Node 20).
if (typeof globalThis.WebSocket === "undefined") {
  try { globalThis.WebSocket = (await import("ws")).default; } catch { /* native WS present, or ws unavailable */ }
}

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const APPLY = process.argv.includes("--apply");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (both required — competitor_map is service-role only)."); process.exit(1); }

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  const [{ data: maps, error: mErr }, { data: products, error: pErr }] = await Promise.all([
    db.from("competitor_map").select("product_id, source, competitor_code, unit_factor"),
    db.from("products").select("id, name, brand, mrp, elume_price"),
  ]);
  if (mErr) { console.error("Read competitor_map failed:", mErr.message); process.exit(1); }
  if (pErr) { console.error("Read products failed (is the key the service-role key?):", pErr.message); process.exit(1); }

  const byId = new Map(products.map((p) => [p.id, p]));
  const mapsByProduct = new Map();
  for (const m of maps ?? []) {
    if (!FETCHERS[m.source]) continue; // skip sources with no fetcher (e.g. ibo)
    if (!mapsByProduct.has(m.product_id)) mapsByProduct.set(m.product_id, []);
    mapsByProduct.get(m.product_id).push(m);
  }

  console.log(`${mapsByProduct.size} mapped products to check (of ${products.length} total). ${APPLY ? "APPLY mode — will write." : "Dry run — no writes."}\n`);

  const changes = [];       // { id, brand, name, oldMrp, newMrp, source, price }
  const skippedBelow = [];  // MRP candidate below our elume_price
  const failed = [];        // no source returned a price

  for (const [productId, rows] of mapsByProduct) {
    const p = byId.get(productId);
    if (!p) continue;

    // Fetch each mapped source's list (MRP) price.
    const candidates = [];
    for (const m of rows) {
      const item = await FETCHERS[m.source](m.competitor_code);
      await sleep(200);
      const list = item?.listPrice;
      if (list == null || !(list > 0)) continue;
      const factor = Number(m.unit_factor) || 1;
      candidates.push({ source: m.source, mrp: Math.round(list * factor), raw: list, factor });
    }
    if (candidates.length === 0) { failed.push({ id: productId, name: p.name }); continue; }

    // Prefer manufacturer-direct sources; then the highest candidate.
    const direct = candidates.filter((c) => BRAND_DIRECT.has(c.source));
    const pool = direct.length ? direct : candidates;
    pool.sort((a, b) => b.mrp - a.mrp);
    const best = pool[0];

    const newMrp = best.mrp;
    const oldMrp = Math.round(Number(p.mrp));
    const elume = Number(p.elume_price);

    if (newMrp < elume) { skippedBelow.push({ id: productId, brand: p.brand, name: p.name, newMrp, elume, source: best.source }); continue; }
    if (newMrp === oldMrp) continue; // already correct
    changes.push({ id: productId, brand: p.brand, name: p.name, oldMrp, newMrp, source: best.source });
  }

  // ── Report ──
  console.log(`Proposed MRP updates (${changes.length}):`);
  console.log("  " + "PRODUCT".padEnd(42) + "OLD MRP".padStart(11) + "NEW MRP".padStart(12) + "  Δ".padEnd(8) + "SOURCE");
  for (const c of changes) {
    const delta = c.oldMrp ? Math.round(((c.newMrp - c.oldMrp) / c.oldMrp) * 100) : 0;
    console.log("  " + `${c.brand} ${c.name}`.slice(0, 41).padEnd(42) + inr(c.oldMrp).padStart(11) + inr(c.newMrp).padStart(12) + `  ${delta > 0 ? "+" : ""}${delta}%`.padEnd(8) + c.source);
  }
  if (skippedBelow.length) {
    console.log(`\n⚠ Skipped — competitor MRP is below our selling price (check these) (${skippedBelow.length}):`);
    for (const s of skippedBelow) console.log(`  ${s.brand} ${s.name.slice(0, 40)} — their MRP ${inr(s.newMrp)} < our price ${inr(s.elume)} [${s.source}]`);
  }
  if (failed.length) console.log(`\n✗ No price returned for ${failed.length} product(s): ${failed.map((f) => f.id).join(", ")}`);

  // ── Reviewable SQL ──
  if (changes.length) {
    const sql = [
      "-- One-time MRP backfill from competitor non-discounted prices.",
      "-- Generated by scripts/backfill-mrp.mjs — review, then run in the Supabase SQL editor.",
      "begin;",
      ...changes.map((c) => `update public.products set mrp = ${c.newMrp} where id = ${JSON.stringify(c.id)}; -- ${c.brand} ${c.name.replace(/\s+/g, " ").slice(0, 60)}: ${c.oldMrp} → ${c.newMrp} (${c.source})`),
      "commit;",
      "",
    ].join("\n");
    mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
    const outPath = new URL("./out/mrp-backfill.sql", import.meta.url);
    writeFileSync(outPath, sql);
    console.log(`\nSQL written to scripts/out/mrp-backfill.sql (${changes.length} updates).`);
  }

  // ── Apply ──
  if (APPLY && changes.length) {
    let ok = 0, bad = 0;
    for (const c of changes) {
      const { error } = await db.from("products").update({ mrp: c.newMrp }).eq("id", c.id);
      if (error) { bad++; console.warn(`  ✗ ${c.id}: ${error.message}`); } else ok++;
    }
    console.log(`\nApplied: ${ok} updated, ${bad} failed.`);
  } else if (changes.length) {
    console.log("\nDry run — nothing written. Re-run with --apply (or run the SQL file) to update products.mrp.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
