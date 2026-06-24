/**
 * Catalogue data access — reads products from Supabase (public `products` table,
 * anon read via RLS). Falls back to the static list in lib/data.ts if Supabase
 * isn't configured or the table is empty, so the storefront never breaks during
 * the migration.
 */
import { createClient } from "@supabase/supabase-js";
import { PRODUCTS as FALLBACK, type Product } from "@/lib/data";

type Row = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  spec: string | null;
  mrp: number | string;
  elume_price: number | string;
  unit: string;
  image_url?: string | null;
};

const toProduct = (r: Row): Product => ({
  id: r.id,
  sku: r.sku,
  name: r.name,
  brand: r.brand,
  cat: r.category,
  spec: r.spec ?? "",
  price: Number(r.elume_price),
  market: Number(r.mrp),
  unit: r.unit,
  image: r.image_url ?? undefined,
});

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchProducts(): Promise<Product[]> {
  const c = client();
  if (!c) return FALLBACK;
  try {
    const { data, error } = await c
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error || !data || data.length === 0) return FALLBACK;
    return (data as Row[]).map(toProduct);
  } catch {
    return FALLBACK;
  }
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const c = client();
  if (!c) return FALLBACK.find((p) => p.id === id) ?? null;
  try {
    const { data, error } = await c.from("products").select("*").eq("id", id).maybeSingle();
    if (error || !data) return FALLBACK.find((p) => p.id === id) ?? null;
    return toProduct(data as Row);
  } catch {
    return FALLBACK.find((p) => p.id === id) ?? null;
  }
}
