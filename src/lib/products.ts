/**
 * Catalogue data access — Supabase (public `products` table, anon read via
 * RLS) is the single source of truth. No static fallback: if Supabase is
 * unreachable the storefront renders an empty catalogue rather than stale data.
 *
 * Variant model: variations are normal product rows whose `parent_id` points
 * at the family's parent product (parent_id NULL = parent/standalone).
 */
import { createClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/data";

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
  parent_id?: string | null;
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
    parentId: r.parent_id ?? undefined,
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
  if (!c) return [];
  try {
    // Order by sort_order THEN id — sort_order values collide across import
    // batches, and an unstable tie order differs between the HTML and RSC
    // renders, causing a hydration mismatch on the home shelves.
    // Page past PostgREST's 1000-row cap so the full catalogue (1300+) is returned.
    const all: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await selectProducts(c, (q) => q.eq("is_active", true).order("sort_order").order("id").range(from, from + 999));
      if (error || !data?.length) break;
      all.push(...(data as Row[]));
      if (data.length < 1000) break;
    }
    return all.map(toProduct);
  } catch {
    return [];
  }
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const c = client();
  if (!c) return null;
  try {
    const { data, error } = await selectProducts(c, (q) => q.eq("id", id).maybeSingle());
    if (error || !data) return null;
    return toProduct(data as Row);
  } catch {
    return null;
  }
}

/**
 * Full variant family for a product: the parent + every variation, whichever
 * member you start from. Returns [] when the product has no family.
 */
export async function fetchFamily(p: Pick<Product, "id" | "parentId">): Promise<Product[]> {
  const c = client();
  if (!c) return [];
  const root = p.parentId ?? p.id;
  try {
    const { data, error } = await selectProducts(c, (q) =>
      q.or(`id.eq.${root},parent_id.eq.${root}`).eq("is_active", true).order("sort_order")
    );
    if (error || !data || data.length < 2) return [];
    return (data as Row[]).map(toProduct);
  } catch {
    return [];
  }
}
