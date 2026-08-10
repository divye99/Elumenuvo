/**
 * Catalogue data access - Supabase (public `products` table, anon read via
 * RLS) is the single source of truth. No static fallback: if Supabase is
 * unreachable the storefront renders an empty catalogue rather than stale data.
 *
 * Variant model: variations are normal product rows whose `parent_id` points
 * at the family's parent product (parent_id NULL = parent/standalone).
 */
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Product, TechSpecs } from "@/lib/data";

type Row = {
  id: string;
  sku: string;
  brand_sku?: string | null;
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
  market_low?: number | string | null;
  in_stock?: boolean | null;
  created_at?: string | null;
  attrs?: Record<string, string> | null;
  images?: string[] | null;
  gst_rate?: number | string | null;
  hsn?: string | null;
  tech_specs?: TechSpecs | null;
  reviews?: { rating: number }[];
};

const toProduct = (r: Row): Product => {
  const ratings = (r.reviews ?? []).map((x) => x.rating);
  return {
    id: r.id,
    sku: r.sku,
    brandSku: r.brand_sku ?? undefined,
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
    marketLow: r.market_low != null ? Number(r.market_low) : undefined,
    inStock: r.in_stock ?? true,
    createdAt: r.created_at ?? undefined,
    attrs: r.attrs ?? undefined,
    images: Array.isArray(r.images) && r.images.length ? (r.images as string[]) : undefined,
    gstRate: r.gst_rate != null ? Number(r.gst_rate) : undefined,
    hsn: r.hsn ?? undefined,
    techSpecs: r.tech_specs ?? undefined,
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

/**
 * The full catalogue is ~1.9 MB from Supabase, and every page that used to
 * fetch it per-request (worst: the force-dynamic homepage, hammered by bots)
 * was the #1 cause of blowing the egress quota. Both catalogue fetchers are
 * now cached ONCE and shared by every page and API for up to 5 minutes.
 *
 * Freshness guarantee: 5 minutes is only the ceiling for changes made with
 * raw SQL. Every admin write path (product edits, repricing, radar accepts,
 * imports, metals console, OOS toggles) calls revalidateTag("products"),
 * which drops this cache instantly - an admin price change is live on the
 * very next request.
 */
export const PRODUCTS_CACHE_TAG = "products";

/**
 * Card-level column set for LIST surfaces (homepage, catalogue, collections,
 * PDP sibling rails). The safe-list rule, audited caller by caller:
 *   - everything SEARCH matches on stays: brand, name, spec, sku, category
 *   - everything CARDS render stays: price/mrp/image/stock/rating join,
 *     attrs (colour swatches, size chips, decision-spec lines)
 *   - what goes is only what NO list surface reads: tech_specs blobs,
 *     gallery arrays, brochure text - the product's own page fetches its
 *     full record via fetchProduct and shows all of it, unchanged.
 * Measured: full row set ≈ 1.9 MB, this set ≈ ⅓ of that.
 */
const CARD_COLS = `${"id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, units_sold, is_recommended, parent_id, market_low, gst_rate, in_stock, created_at"}, attrs`;

async function selectCards(c: NonNullable<ReturnType<typeof client>>, applyFilter: (q: any) => any) {
  // Ratings come from the reviews join (cards show stars); fall back without
  // the join if the relationship is unavailable rather than losing the grid.
  let res = await applyFilter(c.from("products").select(`${CARD_COLS}, reviews(rating)`));
  if (res.error) res = await applyFilter(c.from("products").select(CARD_COLS));
  return res;
}

/** The catalogue is cached in CHUNKS of raw rows, mapped after retrieval:
 *  Next's data cache hard-rejects any entry over 2 MB (and fails SILENTLY in
 *  production - the fetch just runs uncached on every request, which is the
 *  exact egress leak this exists to stop). The whole catalogue serializes
 *  past that line, so each 1500-row chunk is its own comfortably-small cache
 *  entry sharing the same tag and 5-minute window. */
// EXACTLY 1000: PostgREST hard-caps every response at 1000 rows no matter
// what range is requested. A larger chunk silently comes back as 1000, the
// "short chunk = last chunk" check fires early, and the whole storefront
// loses every product past row 1000 - which is precisely the bug that once
// made Atomberg and most wires vanish from the live site.
const ROW_CHUNK = 1000;

const cardRowsChunk = unstable_cache(
  async (page: number): Promise<Row[]> => {
    const c = client();
    if (!c) throw new Error("no client");
    // Order by sort_order THEN id - sort_order values collide across import
    // batches, and an unstable tie order differs between the HTML and RSC
    // renders, causing a hydration mismatch on the home shelves.
    // THROW on failure - a thrown error is never cached, while returning []
    // would cache "catalogue ends here" for 5 minutes.
    const from = page * ROW_CHUNK;
    const { data, error } = await selectCards(c, (q) => q.eq("is_active", true).order("sort_order").order("id").range(from, from + ROW_CHUNK - 1));
    if (error) throw new Error(error.message);
    return (data ?? []) as Row[];
  },
  ["products-card-chunk"],
  { tags: [PRODUCTS_CACHE_TAG], revalidate: 300 }
);

export async function fetchProducts(): Promise<Product[]> {
  try {
    const all: Row[] = [];
    for (let page = 0; ; page++) {
      const rows = await cardRowsChunk(page);
      all.push(...rows);
      if (rows.length < ROW_CHUNK) break;
    }
    return all.map(toProduct);
  } catch {
    // Cache layer unavailable: serve the catalogue uncached rather than empty.
    const c = client();
    if (!c) return [];
    try {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await selectCards(c, (q) => q.eq("is_active", true).order("sort_order").order("id").range(from, from + 999));
        if (error || !data?.length) break;
        all.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      return all.map(toProduct);
    } catch {
      return [];
    }
  }
}

/**
 * Catalogue-grid fetch: display columns only. Skips the attrs/tech_specs
 * jsonb blobs and the reviews join, cutting the payload by an order of
 * magnitude. Use for grids (storefront catalogue, buyer workspace); detail
 * pages keep fetchProduct/fetchProducts for the full record.
 */
const LITE_COLS = "id, sku, name, brand, category, spec, mrp, elume_price, unit, image_url, units_sold, is_recommended, parent_id, market_low, gst_rate, in_stock, created_at";

// Same chunked-cache contract as fetchProducts (see the 2 MB note above):
// shared for ≤5 min, dropped instantly by revalidateTag on admin writes.
const liteRowsChunk = unstable_cache(
  async (page: number): Promise<Row[]> => {
    const c = client();
    if (!c) throw new Error("no client");
    // Same contract as cardRowsChunk: 1000-row chunks (the PostgREST cap),
    // and THROW on failure so an error is never cached as an empty chunk.
    const from = page * ROW_CHUNK;
    const { data, error } = await c.from("products").select(LITE_COLS).eq("is_active", true).order("sort_order").order("id").range(from, from + ROW_CHUNK - 1);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Row[];
  },
  ["products-lite-chunk"],
  { tags: [PRODUCTS_CACHE_TAG], revalidate: 300 }
);

export async function fetchProductsLite(): Promise<Product[]> {
  try {
    const all: Row[] = [];
    for (let page = 0; ; page++) {
      const rows = await liteRowsChunk(page);
      all.push(...rows);
      if (rows.length < ROW_CHUNK) break;
    }
    return all.map(toProduct);
  } catch {
    // Cache layer unavailable: serve uncached rather than empty.
    const c = client();
    if (!c) return [];
    try {
      const all: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await c.from("products").select(LITE_COLS).eq("is_active", true).order("sort_order").order("id").range(from, from + 999);
        if (error || !data?.length) break;
        all.push(...(data as unknown as Row[]));
        if (data.length < 1000) break;
      }
      return all.map(toProduct);
    } catch {
      return [];
    }
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
    // Card columns: the family feeds the variant picker (attrs) and the
    // range rail (ProductCard) - neither reads tech_specs or galleries, and
    // a 37-colour family at full weight was real per-PDP-render tonnage.
    const { data, error } = await selectCards(c, (q) =>
      q.or(`id.eq.${root},parent_id.eq.${root}`).eq("is_active", true).order("sort_order")
    );
    if (error || !data || data.length < 2) return [];
    return (data as Row[]).map(toProduct);
  } catch {
    return [];
  }
}
