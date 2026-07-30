/**
 * Competitor sync core - for one source: log in (if it gates net price),
 * refetch every mapped item's live price, compute the ₹1-under suggestion,
 * upsert the latest snapshot, and append a history row (for the per-product
 * price chart). Used by the admin "Sync now" action and the monthly GitHub
 * Action (which reimplements the same loop for Vashi in plain JS).
 */
import { revalidatePath } from "next/cache";
import { getAdapter, credsFor } from "@/lib/competitors";
import { legrandCodeFor } from "@/lib/competitors/legrandshop";

type SupaLike = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<unknown> };
export type SyncResult = { mapped: number; fetched: number; failed: number; suggestions: number; autoApplied: number; incomplete: boolean };

/** `deadlineMs` (epoch ms) caps in-request work so the admin call returns
 *  cleanly instead of the serverless function timing out; the GitHub Action
 *  runs with no deadline. */
export async function runCompetitorSync(db: SupaLike, source: string, runSource: "cron" | "manual", deadlineMs?: number): Promise<SyncResult> {
  const adapter = getAdapter(source);
  if (!adapter) throw new Error(`Unknown competitor source: ${source}`);
  const ad = adapter; // non-null binding for use inside the concurrency closure

  // Authenticate once if this source gates the net price and creds are set.
  let token: string | null = null;
  if (adapter.needsLogin && adapter.login) {
    const creds = credsFor(source);
    if (creds) token = await adapter.login(creds.username, creds.password);
  }

  // Page past PostgREST's 1000-row cap (BOE alone maps 800+; the catalogue is 1300+).
  const pageAll = async (q: (from: number) => any): Promise<any[]> => {
    const out: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await q(from);
      if (!data?.length) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  };
  const maps = await pageAll((from) => db.from("competitor_map").select("product_id, competitor_code, unit_factor").eq("source", source).order("product_id").range(from, from + 999));
  const products = await pageAll((from) => db.from("products").select("id, elume_price, mrp, brand, brand_sku").order("id").range(from, from + 999));
  const prev = await pageAll((from) => db.from("competitor_prices").select("product_id, comparable_price, status").eq("source", source).order("product_id").range(from, from + 999));

  const priceById = new Map<string, number>((products ?? []).map((p: any) => [p.id, Number(p.elume_price)]));
  const prevById = new Map<string, { comparable: number | null; status: string }>(
    (prev ?? []).map((r: any) => [r.product_id, { comparable: r.comparable_price, status: r.status }])
  );

  let fetched = 0, failed = 0, suggestions = 0, autoApplied = 0, autoMapped = 0;
  const rows = maps ?? [];
  const nowIso = new Date().toISOString();

  // ── HAVELLS ONLY: auto-map + auto-apply ──
  // havells.com is our own-brand price source: the mapping is the product's
  // EXACT brand SKU, so a match cannot be wrong. New Havells products with a
  // brand_sku get mapped automatically here; every other source stays 100%
  // manual (auto-matching burned us before - see the Atomberg remap).
  // Brand-store sources whose prices auto-apply (suggested = comparable − 1,
  // guardrails: > 0 and >= 40% of our current price). Havells set the pattern;
  // Legrand follows the same rules. Auto-MAPPING by exact brand_sku remains
  // Havells-only - Legrand codes are page slugs, seeded at import time.
  const AUTO = source === "havells" || source === "legrand";
  // Auto-mapping by exact brand SKU. Havells: the SKU IS the fetch key.
  // Legrand: the fetch key is a page URL, so the SKU resolves through the
  // bundled crawl index (sku -> slug) and the mapping stores "slug#SKU".
  if (AUTO) {
    const brandName = source === "havells" ? "Havells" : "Legrand";
    const mappedIds = new Set(rows.map((m: any) => m.product_id));
    const candidates = (products ?? []).filter(
      (p: any) => p.brand === brandName && p.brand_sku && !mappedIds.has(p.id)
    );
    for (const p of candidates) {
      const code = source === "havells" ? p.brand_sku : legrandCodeFor(String(p.brand_sku));
      if (!code) continue; // Legrand SKU not in the crawl index - leave unmapped
      const { error } = await db.from("competitor_map").upsert({
        product_id: p.id, source, competitor_code: code, unit_factor: 1,
        note: source === "havells" ? "auto: exact Havells brand SKU" : "auto: Legrand SKU via crawl index",
      });
      if (!error) { rows.push({ product_id: p.id, competitor_code: code, unit_factor: 1 }); autoMapped++; }
    }
  }

  // Bulk pre-fetch where the source supports it (Magento: sku:{in:[...]}).
  // Turns ~2,000 HTTP calls into a few dozen; anything the batch misses still
  // falls through to the per-code path below.
  // Products whose price the auto-apply moved: their cached (ISR) product
  // pages must be regenerated, or the storefront keeps showing the old price.
  const repriced: string[] = [];

  const prefetched = new Map<string, any>();
  if (typeof ad.fetchBatch === "function") {
    try {
      const got = await ad.fetchBatch(rows.map((m: any) => m.competitor_code), token);
      for (const [k, v] of got) prefetched.set(k, v);
    } catch { /* per-code path covers everything */ }
  }

  // Process one mapping: fetch the live price, write the snapshot + history row.
  async function processOne(m: any) {
    const item = prefetched.get(m.competitor_code) ?? await ad.fetchByCode(m.competitor_code, token);
    if (!item) { failed++; return; }

    // The adapter had to resolve the code (e.g. a Magento configurable child
    // that only exists inside its parent's variant tree). Store the resolved
    // form so the next run is a single exact query instead of a search.
    if (item.resolvedCode && item.resolvedCode !== m.competitor_code) {
      try {
        await db.from("competitor_map")
          .update({ competitor_code: item.resolvedCode, updated_at: new Date().toISOString() })
          .eq("product_id", m.product_id).eq("source", source);
      } catch { /* price still syncs even if the rewrite fails */ }
    }

    const factor = Number(m.unit_factor) || 1;
    const effective = item.netPrice ?? item.listPrice;
    const ourPrice = priceById.get(m.product_id) ?? null;
    // Only a BUYABLE competitor (in stock + real >0 price) counts. Otherwise
    // store a NULL comparable + status 'unavailable' - never a bogus ₹0 that
    // would poison the lowest-price math.
    const buyable = item.inStock !== false && effective != null && effective > 0;

    if (!buyable) {
      await db.from("competitor_prices").upsert({
        product_id: m.product_id, source, competitor_code: item.code, competitor_name: item.name, competitor_url: item.url,
        list_price: item.listPrice, net_price: item.netPrice, unit_factor: factor, comparable_price: null,
        suggested_price: null, our_price: ourPrice, status: "unavailable", in_stock: item.inStock ?? false, fetched_at: nowIso,
      });
      return;
    }
    fetched++;

    const comparable = Math.round(effective * factor * 100) / 100;
    const suggested = Math.max(1, Math.round(comparable) - 1);

    // Keep a prior accept/dismiss while the comparable price is unchanged.
    const before = prevById.get(m.product_id);
    const unchanged = before && before.comparable != null && Math.abs(Number(before.comparable) - comparable) < 0.005;
    let status = "pending";
    if (unchanged && (before!.status === "accepted" || before!.status === "dismissed")) status = before!.status;
    // Havells auto-apply: the brand's own store is the trusted benchmark, so
    // the ₹1-under suggestion lands without a manual Accept. Sanity bounds:
    // never below 40% of our current price (a bad scrape must not nuke a
    // price), never a non-positive value.
    let appliedNow = false;
    if (AUTO && status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested
        && suggested > 0 && suggested >= ourPrice * 0.4) {
      const { error: applyErr } = await db.from("products").update({ elume_price: suggested }).eq("id", m.product_id);
      if (!applyErr) {
        appliedNow = true; autoApplied++; repriced.push(m.product_id);
        try {
          await db.from("price_history").insert({ product_id: m.product_id, elume_price: suggested });
        } catch { /* optional log table */ }
      }
    }
    if (!appliedNow && status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested) suggestions++;

    await db.from("competitor_prices").upsert({
      product_id: m.product_id, source, competitor_code: item.code, competitor_name: item.name, competitor_url: item.url,
      list_price: item.listPrice, net_price: item.netPrice, unit_factor: factor, comparable_price: comparable,
      suggested_price: suggested, our_price: appliedNow ? suggested : ourPrice, status: appliedNow ? "accepted" : status, in_stock: item.inStock, fetched_at: nowIso,
    });
    await db.from("competitor_price_history").insert({
      product_id: m.product_id, source, list_price: item.listPrice, net_price: item.netPrice,
      comparable_price: comparable, our_price: ourPrice, captured_at: nowIso,
    });
  }

  // Bounded concurrency - sequential fetches were timing the serverless request
  // out at ~15 products; 8-at-a-time clears far more within the budget.
  const CONCURRENCY = 8;
  let incomplete = false;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    if (deadlineMs && Date.now() > deadlineMs) { incomplete = true; break; } // out of time - stop cleanly
    await Promise.all(rows.slice(i, i + CONCURRENCY).map((m: any) => processOne(m).catch(() => { failed++; })));
  }

  // Re-derive products.market_low (the storefront's "beats the market" signal)
  // for everything this source touched. One RPC, set-based in SQL; tolerated to
  // fail on DBs where migration 0046 has not run yet.
  try {
    await db.rpc("refresh_market_low", { ids: rows.map((m: any) => m.product_id) });
  } catch { /* pre-0046 database - the storefront just falls back to MRP ranking */ }

  if (repriced.length) {
    revalidatePath("/catalogue");
    for (const id of new Set(repriced)) revalidatePath(`/catalogue/${id}`);
  }

  await db.from("competitor_sync_log").insert({ source, mapped: rows.length, fetched, failed, suggestions, run_source: runSource });
  return { mapped: rows.length, fetched, failed, suggestions, autoApplied, incomplete };
}
