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
 * Rates are those in force from 22 Sept 2025 under Notification 9/2025-Central
 * Tax (Rate). Under that schedule essentially every FMEG good sits in
 * Schedule II at 18%: wire & cable, switchgear, boards, parts, fans, water
 * pumps, lamps (8539) and luminaires (9405) alike. There is no LED
 * concession - the old 12% LED entry did not survive the rationalisation.
 *
 * The only 5% goods in this catalogue are named individually in Schedule I:
 * solar lanterns / solar lamps (entry 437(f), renewable energy devices) and
 * EV chargers (entry 438). Those are set per product in products.gst_rate
 * (migration 0065), which always wins over the category fallback below.
 */
export const GST_RATES: Record<string, number> = {
  "Wires & Cables": 0.18,
  "Switchgear": 0.18,
  "Modular": 0.18,
  "Fans": 0.18,
  "DB & Panels": 0.18,
  "Lighting": 0.18,  // Sch II 614 (luminaires) / 511 (lamps); solar overridden per product
  "Pumps": 0.18,     // Sch II 400(c): power driven pumps for handling water
  "Electrical Accessories": 0.18,
  "EV Charging": 0.05, // Sch I entry 438: chargers for electrically operated vehicles
};
export const DEFAULT_GST_RATE = 0.18; // standard FMEG rate for anything unmapped
/** Back-compat alias — prefer gstRateFor(category). */
export const GST_RATE = DEFAULT_GST_RATE;

/**
 * GST rate for a product. A per-product `rate` (products.gst_rate, migration
 * 0062/0065) always wins: a product can sit in a category taxed at one rate
 * while its own HSN carries another. Solar lanterns are the live example —
 * Lighting is 18%, but a solar lantern is a renewable-energy device at 5%
 * (Sch I entry 437(f)). Falls back to the category rate, then 18%.
 */
export function gstRateFor(category?: string | null, rate?: number | null): number {
  if (rate != null && rate > 0) return rate;
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
export function gstBreakdown(inclusive: number, category?: string | null, rate?: number | null): { base: number; gst: number; incl: number; rate: number } {
  const r = gstRateFor(category, rate);
  const base = Math.round(inclusive / (1 + r));
  return { base, gst: inclusive - base, incl: inclusive, rate: r };
}

/** The ex-GST base price (whole rupees) — the storefront's headline number. */
export function baseExGst(inclusive: number, category?: string | null, rate?: number | null): number {
  return gstBreakdown(inclusive, category, rate).base;
}
