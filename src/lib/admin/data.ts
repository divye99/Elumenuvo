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

export async function listContentRows(): Promise<{ key: string; data: unknown }[]> {
  const db = reader();
  if (!db) return [];
  const { data } = await db.from("content").select("key, data").order("key");
  return (data ?? []) as { key: string; data: unknown }[];
}
