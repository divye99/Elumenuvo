/**
 * Catalogue data access - Supabase (public `products` table, anon read via
 * RLS) is the single source of truth. No static fallback: if Supabase is
 * unreachable the storefront renders an empty catalogue rather than stale data.
 *
 * Variant model: variations are normal product rows whose `parent_id` points
 * at the family's parent product (parent_id NULL = parent/standalone).
 */
import { createClient } from "@supabase/supabase-js";
import { timeoutFetch } from "@/lib/supabase/fetch-timeout";
import { unstable_cache } from "next/cache";
import type { Product, TechSpecs } from "@/lib/data";

type Row = {
  id: string;
  sku: string;
  brand_sku?: string | null;
  elin?: string | null;
  ship_weight_kg?: number | string | null;
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
    elin: r.elin ?? undefined,
    shipWeightKg: r.ship_weight_kg != null ? Number(r.ship_weight_kg) : undefined,
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
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: timeoutFetch } });
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
 * cached ONCE and shared by every page and API.
 *
 * Cache window (owner, 21 Aug 2026): SIX HOURS, not five minutes. Vercel
 * bills every data-cache write per 8 KB unit and attributes it to the page
 * that triggered it; these 20 chunk entries are 0.6 to 0.95 MB each, so the
 * old 5-minute ceiling rewrote ~16 MB every five minutes around the clock
 * once bot traffic kept the site warm. That was the whole "ISR Writes" line
 * on the Vercel bill (/catalogue, / and /metals at the top). The ceiling
 * only matters for changes made with raw SQL or backfill scripts: every
 * admin write path (product edits, repricing, radar accepts, imports, metals
 * console, OOS toggles) calls revalidateTag("products") and drops the cache
 * instantly; script and raw-SQL changes are picked up automatically through
 * the catalogue_version watermark (migration 0133, catalogueVersion below).
 *
 * On top of the data cache, each warm function instance memoises the mapped
 * catalogue for MEMO_MS, so a burst of requests (the rails endpoint on every
 * product view, hub regenerations) reads the chunks once per instance
 * instead of ten ~0.8 MB cache reads per request. Instances other than the
 * one that performed an admin write therefore lag it by at most MEMO_MS.
 */
export const PRODUCTS_CACHE_TAG = "products";
export const PRODUCTS_CACHE_SECONDS = 6 * 3600;
const MEMO_MS = 60_000;
let cardsMemo: { at: number; p: Promise<Product[]> } | null = null;
let liteMemo: { at: number; p: Promise<Product[]> } | null = null;
/** Drop the per-instance memo (the admin write path calls this right after
 *  revalidateTag so the writing instance is fresh on its very next request). */
let versionMemo: { at: number; v: string } | null = null;
const VERSION_MEMO_MS = 60_000;
/** Catalogue watermark (migration 0133): one row in public.catalogue_version
 *  that statement-level triggers bump on every insert/update/delete of
 *  products or reviews, however the change was made: console, script, raw
 *  SQL. The chunk caches are keyed by it, so ANY change reaches the
 *  storefront within VERSION_MEMO_MS with no buttons or manual revalidation,
 *  and new cache entries are written only when the catalogue actually
 *  changed. Before 0133 (table missing) the value stays "0" and the time
 *  window plus the "products" tag govern freshness exactly as before. */
export async function catalogueVersion(): Promise<string> {
  if (versionMemo && Date.now() - versionMemo.at < VERSION_MEMO_MS) return versionMemo.v;
  let v = versionMemo?.v ?? "0";
  const c = client();
  if (c) {
    try {
      const { data, error } = await c.from("catalogue_version").select("version").eq("singleton", true).maybeSingle();
      if (!error && data?.version != null) v = String(data.version);
    } catch { /* keep the last known version */ }
  }
  versionMemo = { at: Date.now(), v };
  return v;
}
export function forgetCatalogueMemo() { cardsMemo = null; liteMemo = null; versionMemo = null; }

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
const CARD_COLS = `${"id, sku, brand_sku, elin, ship_weight_kg, name, brand, category, spec, mrp, elume_price, unit, image_url, units_sold, is_recommended, parent_id, market_low, gst_rate, in_stock, created_at"}, attrs`;
// Pre-migration databases miss columns; selecting a missing column is a
// PostgREST error, and an erroring catalogue fetch would blank the store.
// Fallback ladder: no elin (pre-0116), then neither elin nor ship_weight_kg
// (pre-0110).
const CARD_COLS_NO_ELIN = CARD_COLS.replace("elin, ", "");
const CARD_COLS_LEGACY = CARD_COLS_NO_ELIN.replace("ship_weight_kg, ", "");

async function selectCards(c: NonNullable<ReturnType<typeof client>>, applyFilter: (q: any) => any) {
  // Ratings come from the reviews join (cards show stars); fall back without
  // the join if the relationship is unavailable rather than losing the grid,
  // then without ship_weight_kg on pre-0110 databases.
  let res = await applyFilter(c.from("products").select(`${CARD_COLS}, reviews(rating)`));
  if (res.error) res = await applyFilter(c.from("products").select(CARD_COLS));
  if (res.error) res = await applyFilter(c.from("products").select(`${CARD_COLS_NO_ELIN}, reviews(rating)`));
  if (res.error) res = await applyFilter(c.from("products").select(CARD_COLS_NO_ELIN));
  if (res.error) res = await applyFilter(c.from("products").select(`${CARD_COLS_LEGACY}, reviews(rating)`));
  if (res.error) res = await applyFilter(c.from("products").select(CARD_COLS_LEGACY));
  return res;
}

/** Look a product up by its ELIN (migration 0116). Used by the /catalogue
 *  route to 301 an ELIN URL to the product's canonical address, and by admin
 *  tooling. Returns null pre-0116 (missing column) instead of erroring. */
export async function fetchProductByElin(elin: string): Promise<Product | null> {
  const c = client();
  if (!c) return null;
  try {
    const { data, error } = await selectProducts(c, (q) => q.eq("elin", elin.trim().toUpperCase()).maybeSingle());
    if (error || !data) return null;
    return toProduct(data as Row);
  } catch {
    return null;
  }
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
  // _version is part of the cache key only: see catalogueVersion().
  async (page: number, _version: string): Promise<Row[]> => {
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
  { tags: [PRODUCTS_CACHE_TAG], revalidate: PRODUCTS_CACHE_SECONDS }
);

export async function fetchProducts(): Promise<Product[]> {
  if (cardsMemo && Date.now() - cardsMemo.at < MEMO_MS) return cardsMemo.p;
  const p = fetchProductsUncached();
  cardsMemo = { at: Date.now(), p };
  // A failed or empty load must not be memoised: the next request retries.
  p.then((rows) => { if (!rows.length) cardsMemo = null; }, () => { cardsMemo = null; });
  return p;
}

async function fetchProductsUncached(): Promise<Product[]> {
  try {
    const version = await catalogueVersion();
    const all: Row[] = [];
    for (let page = 0; ; page++) {
      const rows = await cardRowsChunk(page, version);
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
// shared for up to PRODUCTS_CACHE_SECONDS, dropped instantly by revalidateTag on admin writes.
const liteRowsChunk = unstable_cache(
  async (page: number, _version: string): Promise<Row[]> => {
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
  { tags: [PRODUCTS_CACHE_TAG], revalidate: PRODUCTS_CACHE_SECONDS }
);

export async function fetchProductsLite(): Promise<Product[]> {
  if (liteMemo && Date.now() - liteMemo.at < MEMO_MS) return liteMemo.p;
  const p = fetchProductsLiteUncached();
  liteMemo = { at: Date.now(), p };
  p.then((rows) => { if (!rows.length) liteMemo = null; }, () => { liteMemo = null; });
  return p;
}

async function fetchProductsLiteUncached(): Promise<Product[]> {
  try {
    const version = await catalogueVersion();
    const all: Row[] = [];
    for (let page = 0; ; page++) {
      const rows = await liteRowsChunk(page, version);
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
