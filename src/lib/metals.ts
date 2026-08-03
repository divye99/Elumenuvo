/**
 * Metals catalogue taxonomy + helpers (client-safe, pure).
 *
 * Metals products live in the same public.products table as FMEG; the
 * DISCRIMINATOR is the category value. Everything metals-specific keys off
 * METALS_CATEGORIES: FMEG admin surfaces exclude these categories, the
 * metals console includes only them.
 *
 * Pricing model (differs from list-priced FMEG goods):
 *   - Copper is commodity-priced; the admin quotes an EX-GST ₹/kg rate in
 *     /admin/metals (trade convention) two to three times a day.
 *   - products.elume_price stays GST-INCLUSIVE (site-wide convention) and is
 *     PER SELLING UNIT: per kg for Super D, per LOT for rods (attrs.Lot
 *     '3 MT'/'4 MT' → 3000/4000 kg).
 */

/** Product categories that belong to the Metals family (vs FMEG). */
export const METALS_CATEGORIES = ["Copper"];

export function isMetalCategory(category?: string | null): boolean {
  return category != null && METALS_CATEGORIES.includes(category);
}

/** The public Metals taxonomy. `live` = buyable online; the rest are
 *  enquiry-only (business-format form → metal_enquiries). */
export type MetalEntry = { name: string; group: "Non-Ferrous" | "Ferrous"; live: boolean };
export const METALS_TAXONOMY: MetalEntry[] = [
  { name: "Copper", group: "Non-Ferrous", live: true },
  { name: "Aluminium", group: "Non-Ferrous", live: false },
  { name: "Zinc", group: "Non-Ferrous", live: false },
  { name: "Lead", group: "Non-Ferrous", live: false },
  { name: "Nickel", group: "Non-Ferrous", live: false },
  { name: "MS/TMT Steel", group: "Ferrous", live: false },
  { name: "Stainless Steel", group: "Ferrous", live: false },
];

/** Metals a visitor can raise an enquiry about (everything, including copper -
 *  bulk copper buyers may prefer to talk before ordering). */
export const ENQUIRY_METALS = METALS_TAXONOMY.map((m) => m.name);

/** Kg per selling unit: rods carry attrs.Lot ('3 MT' → 3000 kg); everything
 *  else (Super D) sells per kg. */
export function lotKg(attrs?: Record<string, string> | null): number {
  const lot = attrs?.Lot;
  if (!lot) return 1;
  const mt = parseFloat(lot);
  return Number.isFinite(mt) && mt > 0 ? Math.round(mt * 1000) : 1;
}

/** Derive the ex-GST ₹/kg rate back out of a stored GST-inclusive unit price. */
export function ratePerKgExGst(inclusivePrice: number, gstRate: number, attrs?: Record<string, string> | null): number {
  return inclusivePrice / (1 + gstRate) / lotKg(attrs);
}

/** Stored GST-inclusive unit price for an ex-GST ₹/kg rate. Lot-priced rods
 *  round to whole rupees (lakh-scale, sub-paisa drift); per-kg products keep
 *  paise so a 2-decimal trade rate survives the round-trip (whole-rupee
 *  rounding would move a ₹805.55/kg quote by up to ₹0.42/kg). */
export function unitPriceFromRate(rateExGstPerKg: number, gstRate: number, attrs?: Record<string, string> | null): number {
  const kg = lotKg(attrs);
  const gross = rateExGstPerKg * (1 + gstRate) * kg;
  return kg === 1 ? Math.round(gross * 100) / 100 : Math.round(gross);
}
