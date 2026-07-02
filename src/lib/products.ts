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
  units_sold?: number | null;
  is_recommended?: boolean | null;
  variant_group?: string | null;
  attrs?: Record<string, string> | null;
  reviews?: { rating: number }[];
};

const toProduct = (r: Row): Product => {
  const ratings = (r.reviews ?? []).map((x) => x.rating);
  return {
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
    rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : undefined,
    ratingCount: ratings.length,
    unitsSold: r.units_sold ?? 0,
    recommended: r.is_recommended ?? false,
    variantGroup: r.variant_group ?? undefined,
    attrs: r.attrs ?? undefined,
  };
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// Select with embedded review ratings; falls back to a plain select if the
// reviews table doesn't exist yet (SQL not run).
async function selectProducts(c: NonNullable<ReturnType<typeof client>>, applyFilter: (q: any) => any) {
  let res = await applyFilter(c.from("products").select("*, reviews(rating)"));
  if (res.error) res = await applyFilter(c.from("products").select("*"));
  return res;
}

export async function fetchProducts(): Promise<Product[]> {
  const c = client();
  if (!c) return FALLBACK;
  try {
    const { data, error } = await selectProducts(c, (q) => q.eq("is_active", true).order("sort_order"));
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
    const { data, error } = await selectProducts(c, (q) => q.eq("id", id).maybeSingle());
    if (error || !data) return FALLBACK.find((p) => p.id === id) ?? null;
    return toProduct(data as Row);
  } catch {
    return FALLBACK.find((p) => p.id === id) ?? null;
  }
}

/** Sibling products in the same variant family (includes the product itself). */
export async function fetchVariantSiblings(group: string): Promise<Product[]> {
  const staticSiblings = FALLBACK.filter((p) => p.variantGroup === group);
  const c = client();
  if (!c) return staticSiblings;
  try {
    const { data, error } = await selectProducts(c, (q) => q.eq("variant_group", group).eq("is_active", true).order("sort_order"));
    if (error || !data || data.length === 0) return staticSiblings;
    return (data as Row[]).map(toProduct);
  } catch {
    return staticSiblings;
  }
}
