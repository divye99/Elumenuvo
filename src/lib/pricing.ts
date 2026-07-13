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

/**
 * GST model.
 *
 * Prices are STORED GST-inclusive (MRP is legally the all-inclusive retail
 * price, and competitor feeds quote inclusive prices — so the underlying money
 * math, checkout total, invoices and competitor matching all stay on the true
 * inclusive amount). The STOREFRONT DISPLAYS the ex-GST base as the headline
 * number (B2B convention: base is what varies, GST is a statutory add-on),
 * with the GST and the inclusive total shown alongside.
 *
 * FMEG GST rates vary by category, so we key the rate off the product category
 * rather than a single flat rate. VERIFY these against current rates.
 */
export const GST_RATES: Record<string, number> = {
  "Wires & Cables": 0.18,
  "Switchgear": 0.18,
  "Modular": 0.18,
  "Fans": 0.18,
  "DB & Panels": 0.18,
  "Lighting": 0.12, // LED lighting has historically been 12% — confirm current rate
};
export const DEFAULT_GST_RATE = 0.18; // standard FMEG rate for anything unmapped
/** Back-compat alias — prefer gstRateFor(category). */
export const GST_RATE = DEFAULT_GST_RATE;

/** GST rate for a product's category (falls back to the standard rate). */
export function gstRateFor(category?: string | null): number {
  return (category != null && GST_RATES[category]) || DEFAULT_GST_RATE;
}

/** Taxable (ex-GST) value inside a GST-inclusive amount, at a given rate. */
export function exGst(inclusive: number, rate: number = DEFAULT_GST_RATE): number {
  return inclusive / (1 + rate);
}

/** GST amount contained in a GST-inclusive amount, at a given rate. */
export function gstPart(inclusive: number, rate: number = DEFAULT_GST_RATE): number {
  return inclusive - exGst(inclusive, rate);
}

/** Split a GST-inclusive amount into { base, gst, incl, rate } for a category.
 *  Base is rounded to whole rupees; gst is the exact remainder so base+gst=incl. */
export function gstBreakdown(inclusive: number, category?: string | null): { base: number; gst: number; incl: number; rate: number } {
  const rate = gstRateFor(category);
  const base = Math.round(inclusive / (1 + rate));
  return { base, gst: inclusive - base, incl: inclusive, rate };
}

/** The ex-GST base price (whole rupees) — the storefront's headline number. */
export function baseExGst(inclusive: number, category?: string | null): number {
  return gstBreakdown(inclusive, category).base;
}
