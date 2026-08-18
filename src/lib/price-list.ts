import { slugify } from "@/lib/slug";
import type { Product } from "@/lib/data";

/**
 * Price-list pages: /price-list/<brand>-<category> ("havells-switchgear").
 *
 * SEO asset built entirely from OUR OWN live selling prices (the same
 * numbers every product page already shows publicly) - no brand MRP
 * authorization involved. Targets "havells mcb price list 2026" style
 * commercial queries where marketplaces have no dedicated page and brand
 * sites hide prices behind dealers.
 *
 * A combo earns a page only with MIN_ITEMS products, so no thin pages.
 */
export const MIN_ITEMS = 6;
/** Cap rows so one mega-brand page cannot balloon; sorted by popularity first. */
export const MAX_ROWS = 300;

export type PriceListCombo = { brand: string; cat: string; slug: string; count: number };

const comboSlug = (brand: string, cat: string) => `${slugify(brand)}-${slugify(cat)}`;

/** Sellable rows: active variants and singles, never hidden drafts (price 0). */
const sellable = (p: Product) => Number(p.price) > 0;

export function listPriceListCombos(all: Product[]): PriceListCombo[] {
  const byCombo = new Map<string, PriceListCombo>();
  for (const p of all) {
    if (!sellable(p)) continue;
    const slug = comboSlug(p.brand, p.cat);
    const e = byCombo.get(slug);
    if (e) e.count++;
    else byCombo.set(slug, { brand: p.brand, cat: p.cat, slug, count: 1 });
  }
  return [...byCombo.values()]
    .filter((c) => c.count >= MIN_ITEMS)
    .sort((a, b) => b.count - a.count);
}

export function comboFromSlug(all: Product[], slug: string): PriceListCombo | null {
  return listPriceListCombos(all).find((c) => c.slug === slug) ?? null;
}

/** Rows for one combo, most-bought first then cheapest, capped at MAX_ROWS. */
export function priceListRows(all: Product[], combo: PriceListCombo): Product[] {
  return all
    .filter((p) => p.brand === combo.brand && p.cat === combo.cat && sellable(p))
    .sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0) || Number(a.price) - Number(b.price))
    .slice(0, MAX_ROWS);
}
