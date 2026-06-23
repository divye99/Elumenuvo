/**
 * Elume pricing model (single source of truth).
 *
 * Three prices per product:
 *   1. MRP            — supplier's list price (the `market` field on a Product)
 *   2. Elume price    — our single-unit selling price (the `price` field)
 *   3. Wholesale      — 5% below the Elume price, for orders of 15+ units
 */
export const WHOLESALE_DISCOUNT = 0.05; // 5% off the Elume price
export const WHOLESALE_MIN_QTY = 15;

/** Per-unit wholesale price (Elume price − 5%). */
export function wholesalePrice(elumePrice: number): number {
  return Math.round(elumePrice * (1 - WHOLESALE_DISCOUNT));
}

/** Effective per-unit price for a quantity — wholesale kicks in at the min qty. */
export function unitPriceFor(elumePrice: number, qty: number): number {
  return qty >= WHOLESALE_MIN_QTY ? wholesalePrice(elumePrice) : elumePrice;
}

/** Discount of the Elume price vs MRP, as a rounded whole percent. */
export function offMrpPct(elumePrice: number, mrp: number): number {
  if (!mrp || mrp <= 0) return 0;
  return Math.round((1 - elumePrice / mrp) * 100);
}
