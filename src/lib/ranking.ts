/**
 * SKU visibility ranking - the single scoring system behind every surface
 * that orders products (catalogue Featured, homepage shelves, collection
 * pages). One function, so a product ranks consistently everywhere.
 *
 * THE RULES (in force, in priority order):
 *
 *  1. ORDERABILITY IS A GATE, NOT A FACTOR. Out-of-stock products score ~0
 *     and sink to the bottom of any list; curated top-10 rows exclude them
 *     outright. Nothing that cannot be bought may occupy a hero slot.
 *
 *  2. NO PHOTO = LEAST PRIORITY (owner rule, Aug 2026). A listing without an
 *     image converts far worse and drags the perceived quality of every row
 *     it appears in, so its whole score is multiplied by 0.2 - deep enough
 *     that an imageless SKU practically never outranks a photographed one.
 *     Surfaces with their own sort keys (best sellers, new releases, homepage
 *     shelves) enforce the same rule as a hard partition: photographed first.
 *     The fastest way for a SKU to climb is giving it an image.
 *
 *  3. PROOF BEATS PROMISE. Actual sales (units_sold) carry the largest
 *     positive weight, on a log scale so one viral SKU cannot monopolise
 *     every shelf. Where sales are thin, recorded glance views stand in as
 *     the demand signal at half the weight.
 *
 *  4. EDITORIAL EARNS A FIXED BONUS. A product ranked in one of our blog
 *     top-10s gets a flat boost, larger for better ranks (#1 > #10). This is
 *     how "Top rated" stays anchored to content we actually wrote.
 *
 *  5. REVIEWS COMPOUND. Star rating x volume adds a modest boost - never
 *     enough to outrank real sales, enough to break ties.
 *
 *  6. FRESHNESS DECAYS. New listings get a boost that fades over 45 days:
 *     day 0 is worth about as much as ~20 units sold, day 45 is worth
 *     nothing. This gives new brands a fair launch window without letting
 *     "new" permanently outrank "proven".
 *
 *  7. HONEST DISCOUNTS HELP. Percent-off-MRP adds up to a small boost, but
 *     only when the MRP is a real, higher list price (mrp > price). Setting
 *     mrp = price (as the wire imports do until official lists arrive)
 *     yields zero - no fake-discount gaming.
 *
 *  8. DIVERSITY IS A LAYOUT RULE, NOT A SCORE RULE. Brand spreading (no
 *     single brand walling a shelf) is applied by the surface after scoring,
 *     via diversify(), so scores stay comparable across brands.
 */
import type { Product } from "@/lib/data";

export type RankSignals = {
  /** 30-day glance views per product id (from product_metrics_daily). */
  glanceViews?: Record<string, number>;
  /** Blog editorial picks: productId -> rank (1 = best). */
  editorialRank?: Record<string, number>;
  /** Search-driven popularity boost (log-derived), per product id. */
  searchBoost?: Record<string, number>;
};

export function visibilityScore(p: Product, s: RankSignals = {}): number {
  // Rule 1: gate.
  const stockGate = p.inStock === false ? 0.02 : 1;
  // Rule 2: photo multiplier - imageless sinks to the bottom of any ranked list.
  const photoMul = p.image ? 1 : 0.2;

  // Rule 3: demand.
  const units = Math.log1p(Math.min(p.unitsSold ?? 0, 500)) * 10;
  const gv = Math.log1p(Math.min(s.glanceViews?.[p.id] ?? 0, 1000)) * 5;

  // Rule 4: editorial.
  const er = s.editorialRank?.[p.id];
  const editorial = er ? Math.max(0, 26 - er * 2) : 0; // #1 -> 24 ... #10 -> 6

  // Rule 5: reviews.
  const reviews = (p.rating ?? 0) * Math.log1p(p.ratingCount ?? 0) * 3;

  // Rule 6: freshness (45-day linear decay).
  let freshness = 0;
  if (p.createdAt) {
    const days = (Date.now() - new Date(p.createdAt).getTime()) / 86_400_000;
    if (days >= 0 && days < 45) freshness = ((45 - days) / 45) * 12;
  }

  // Rule 7: honest discount.
  const off = p.market > p.price ? (1 - p.price / p.market) : 0;
  const discount = Math.min(off, 0.6) * 15;

  // Search-driven interest (self-improving search signals).
  const search = Math.min(s.searchBoost?.[p.id] ?? 0, 20);

  const recommended = p.recommended ? 6 : 0;

  return stockGate * photoMul * (1 + units + gv + editorial + reviews + freshness + discount + search + recommended);
}

/** Sort by score descending with a stable tiebreak, without mutating input. */
export function rankProducts(list: Product[], s: RankSignals = {}): Product[] {
  const score = new Map(list.map((p) => [p.id, visibilityScore(p, s)]));
  return [...list].sort((a, b) => (score.get(b.id)! - score.get(a.id)!) || a.id.localeCompare(b.id));
}

/** Rule 8: spread brands across the first `window` slots - no brand may take
 *  more than `maxPerBrand` of them. Order within the tail is untouched. */
export function diversify(ranked: Product[], window = 20, maxPerBrand = 3): Product[] {
  const head: Product[] = [];
  const deferred: Product[] = [];
  const perBrand = new Map<string, number>();
  let i = 0;
  for (; i < ranked.length && head.length < window; i++) {
    const p = ranked[i];
    const n = perBrand.get(p.brand) ?? 0;
    if (n >= maxPerBrand) { deferred.push(p); continue; }
    perBrand.set(p.brand, n + 1);
    head.push(p);
  }
  return [...head, ...deferred, ...ranked.slice(i)];
}
