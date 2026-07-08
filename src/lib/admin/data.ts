import { createClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  spec: string | null;
  mrp: number;
  elume_price: number;
  unit: string;
  sort_order: number;
  is_active: boolean;
  image_url: string | null;
  attrs: Record<string, string> | null;
  parent_id: string | null;
  is_recommended: boolean;
  units_sold: number;
};

// Prefer the service-role client (sees inactive rows too); fall back to anon read.
function reader() {
  const a = adminClient();
  if (a) return a;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function hasServiceRole(): boolean {
  return !!adminClient();
}

/** Read every row of a table, paging past PostgREST's 1000-row response cap. */
async function readAll<T>(db: any, table: string, columns = "*", order = "id"): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from(table).select(columns).order(order).range(from, from + 999);
    if (!data?.length) break;
    out.push(...(data as T[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function listProductRows(): Promise<ProductRow[]> {
  const db = reader();
  if (!db) return [];
  return readAll<ProductRow>(db, "products", "*", "sort_order");
}

export async function getProductRow(id: string): Promise<ProductRow | null> {
  const db = reader();
  if (!db) return null;
  const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
  return (data as ProductRow) ?? null;
}

export type ImportLogRow = {
  id: string;
  actor: string;
  filename: string;
  added: number;
  updated: number;
  removed: number;
  summary: string[] | null;
  created_at: string;
};

export async function listImportLog(limit = 20): Promise<ImportLogRow[]> {
  const db = reader();
  if (!db) return [];
  const { data, error } = await db
    .from("import_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return []; // table may not exist yet
  return data as ImportLogRow[];
}

/* ── Competitor price radar (multi-source) ── */
export type CompetitorSource = { id: string; name: string; site_url: string | null; enabled: boolean; needs_login: boolean; sort_order: number };
export type CompetitorMapRow = { product_id: string; source: string; competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null };
export type CompetitorPriceRow = {
  product_id: string;
  source: string;
  competitor_code: string | null;
  competitor_name: string | null;
  competitor_url: string | null;
  list_price: number | null;
  net_price: number | null;
  unit_factor: number | null;
  comparable_price: number | null;
  suggested_price: number | null;
  our_price: number | null;
  status: string;
  in_stock: boolean | null;
  fetched_at: string;
};

export async function listCompetitorSources(): Promise<CompetitorSource[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("competitor_sources").select("*").order("sort_order");
  return (data ?? []) as CompetitorSource[];
}

export async function listCompetitorMap(): Promise<CompetitorMapRow[]> {
  const db = reader();
  if (!db) return [];
  return readAll<CompetitorMapRow>(db, "competitor_map", "*", "product_id");
}

export async function listCompetitorPrices(): Promise<CompetitorPriceRow[]> {
  const db = reader();
  if (!db) return [];
  return readAll<CompetitorPriceRow>(db, "competitor_prices", "*", "product_id");
}

export async function lastCompetitorSync(): Promise<{ created_at: string; mapped: number; fetched: number; failed: number; suggestions: number; run_source: string; source: string } | null> {
  const db = reader();
  if (!db) return null;
  const { data } = await db.from("competitor_sync_log").select("*").order("created_at", { ascending: false }).limit(1);
  return (data?.[0] as any) ?? null;
}

/** A suggestion is actionable when pending and our price differs from ₹1-under. */
export function isActionable(p: CompetitorPriceRow): boolean {
  return p.status === "pending" && p.our_price != null && p.suggested_price != null && Math.round(p.our_price) !== p.suggested_price;
}

/** Count PRODUCTS (not source rows) where we'd reprice to ₹1 under the LOWEST
 *  mapped seller — matches the Amazon-style product-level recommendation. */
export async function countPendingSuggestions(): Promise<number> {
  const prices = await listCompetitorPrices();
  const lowestByProduct = new Map<string, { our: number | null; low: number; anyPending: boolean }>();
  for (const p of prices) {
    if (p.comparable_price == null || p.comparable_price <= 0) continue;
    const e = lowestByProduct.get(p.product_id) ?? { our: p.our_price, low: p.comparable_price, anyPending: false };
    e.low = Math.min(e.low, p.comparable_price);
    if (p.our_price != null) e.our = p.our_price;
    if (p.status === "pending") e.anyPending = true;
    lowestByProduct.set(p.product_id, e);
  }
  let n = 0;
  for (const { our, low, anyPending } of lowestByProduct.values()) {
    if (anyPending && our != null && Math.round(our) !== Math.max(1, Math.round(low) - 1)) n++;
  }
  return n;
}

export async function listRepricingRules(): Promise<import("@/lib/admin/repricing").RepricingRule[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("repricing_settings").select("*");
  return (data ?? []) as import("@/lib/admin/repricing").RepricingRule[];
}

export async function listContentRows(): Promise<{ key: string; data: unknown }[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("content").select("key, data").order("key");
  return (data ?? []) as { key: string; data: unknown }[];
}

/* ── Orders / fulfilment ── */

export type OrderItem = { id: string; name: string; qty: number; price?: number };
export type OrderRow = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  gstin: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_method: string | null;
  items: OrderItem[] | null;
  subtotal: number | null;
  total: number | null;
  status: string;
  is_guest: boolean | null;
  admin_note: string | null;
  cancel_reason: string | null;
  delivered_at: string | null;
};
export type Shipment = {
  id: string;
  order_id: string;
  courier: string | null;
  awb: string | null;
  tracking_url: string | null;
  items: OrderItem[] | null;
  status: string;
  proof_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
};
export type OrderEvent = { id: string; order_id: string; status: string; note: string | null; created_at: string };

const OPEN_ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery"];

export async function listOrders(): Promise<OrderRow[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("orders").select("*").order("created_at", { ascending: false });
  return (data ?? []) as OrderRow[];
}

export async function countOpenOrders(): Promise<number> {
  const db = reader();
  if (!db) return 0;
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).in("status", OPEN_ORDER_STATUSES);
  return count ?? 0;
}

export async function getOrderDetail(id: string): Promise<{ order: OrderRow; shipments: Shipment[]; events: OrderEvent[] } | null> {
  const db = reader();
  if (!db) return null;
  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) return null;
  const [{ data: shipments }, { data: events }] = await Promise.all([
    db.from("order_shipments").select("*").eq("order_id", id).order("created_at", { ascending: true }),
    db.from("order_events").select("*").eq("order_id", id).order("created_at", { ascending: true }),
  ]);
  return { order: order as OrderRow, shipments: (shipments ?? []) as Shipment[], events: (events ?? []) as OrderEvent[] };
}
