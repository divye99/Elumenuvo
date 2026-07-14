/**
 * Competitor sync core — for one source: log in (if it gates net price),
 * refetch every mapped item's live price, compute the ₹1-under suggestion,
 * upsert the latest snapshot, and append a history row (for the per-product
 * price chart). Used by the admin "Sync now" action and the monthly GitHub
 * Action (which reimplements the same loop for Vashi in plain JS).
 */
import { getAdapter, credsFor } from "@/lib/competitors";

type SupaLike = { from: (t: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<unknown> };
export type SyncResult = { mapped: number; fetched: number; failed: number; suggestions: number; incomplete: boolean };

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
  const products = await pageAll((from) => db.from("products").select("id, elume_price").order("id").range(from, from + 999));
  const prev = await pageAll((from) => db.from("competitor_prices").select("product_id, comparable_price, status").eq("source", source).order("product_id").range(from, from + 999));

  const priceById = new Map<string, number>((products ?? []).map((p: any) => [p.id, Number(p.elume_price)]));
  const prevById = new Map<string, { comparable: number | null; status: string }>(
    (prev ?? []).map((r: any) => [r.product_id, { comparable: r.comparable_price, status: r.status }])
  );

  let fetched = 0, failed = 0, suggestions = 0;
  const rows = maps ?? [];
  const nowIso = new Date().toISOString();

  // Process one mapping: fetch the live price, write the snapshot + history row.
  async function processOne(m: any) {
    const item = await ad.fetchByCode(m.competitor_code, token);
    if (!item) { failed++; return; }

    const factor = Number(m.unit_factor) || 1;
    const effective = item.netPrice ?? item.listPrice;
    const ourPrice = priceById.get(m.product_id) ?? null;
    // Only a BUYABLE competitor (in stock + real >0 price) counts. Otherwise
    // store a NULL comparable + status 'unavailable' — never a bogus ₹0 that
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
    if (status === "pending" && ourPrice != null && Math.round(ourPrice) !== suggested) suggestions++;

    await db.from("competitor_prices").upsert({
      product_id: m.product_id, source, competitor_code: item.code, competitor_name: item.name, competitor_url: item.url,
      list_price: item.listPrice, net_price: item.netPrice, unit_factor: factor, comparable_price: comparable,
      suggested_price: suggested, our_price: ourPrice, status, in_stock: item.inStock, fetched_at: nowIso,
    });
    await db.from("competitor_price_history").insert({
      product_id: m.product_id, source, list_price: item.listPrice, net_price: item.netPrice,
      comparable_price: comparable, our_price: ourPrice, captured_at: nowIso,
    });
  }

  // Bounded concurrency — sequential fetches were timing the serverless request
  // out at ~15 products; 8-at-a-time clears far more within the budget.
  const CONCURRENCY = 8;
  let incomplete = false;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    if (deadlineMs && Date.now() > deadlineMs) { incomplete = true; break; } // out of time — stop cleanly
    await Promise.all(rows.slice(i, i + CONCURRENCY).map((m: any) => processOne(m).catch(() => { failed++; })));
  }

  // Re-derive products.market_low (the storefront's "beats the market" signal)
  // for everything this source touched. One RPC, set-based in SQL; tolerated to
  // fail on DBs where migration 0046 has not run yet.
  try {
    await db.rpc("refresh_market_low", { ids: rows.map((m: any) => m.product_id) });
  } catch { /* pre-0046 database — the storefront just falls back to MRP ranking */ }

  await db.from("competitor_sync_log").insert({ source, mapped: rows.length, fetched, failed, suggestions, run_source: runSource });
  return { mapped: rows.length, fetched, failed, suggestions, incomplete };
}
