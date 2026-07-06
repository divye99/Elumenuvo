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

export async function listProductRows(): Promise<ProductRow[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("products").select("*").order("sort_order");
  return (data ?? []) as ProductRow[];
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
  const { data } = await db.from("competitor_map").select("*");
  return (data ?? []) as CompetitorMapRow[];
}

export async function listCompetitorPrices(): Promise<CompetitorPriceRow[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("competitor_prices").select("*");
  return (data ?? []) as CompetitorPriceRow[];
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

export async function countPendingSuggestions(): Promise<number> {
  const prices = await listCompetitorPrices();
  return prices.filter(isActionable).length;
}

export async function listContentRows(): Promise<{ key: string; data: unknown }[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("content").select("key, data").order("key");
  return (data ?? []) as { key: string; data: unknown }[];
}
