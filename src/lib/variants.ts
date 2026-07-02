import type { Product } from "@/lib/data";

/** Shared variant logic — used by the detail-page picker and the catalogue
 *  hover swatches. Siblings share `variantGroup` and differ by `attrs`. */

export const DIM_ORDER = ["Size", "Colour", "Length", "Quality"];

/** Swatch colours for known Colour attr values. */
export const COLOUR_HEX: Record<string, string> = {
  Red: "#D93025",
  Blue: "#1A73E8",
  Black: "#202124",
  Yellow: "#F4B400",
  Green: "#188038",
  White: "#FFFFFF",
  Grey: "#9AA0A6",
  Brown: "#8B5E3C",
};

/** Dimensions present across a sibling set, in display order. */
export function dimsOf(siblings: Product[]): string[] {
  return Array.from(new Set(siblings.flatMap((s) => Object.keys(s.attrs ?? {})))).sort((a, b) => {
    const ia = DIM_ORDER.indexOf(a);
    const ib = DIM_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Distinct values for one dimension, numerically then lexically sorted. */
export function valuesOf(siblings: Product[], dim: string): string[] {
  return Array.from(new Set(siblings.map((s) => s.attrs?.[dim]).filter(Boolean) as string[])).sort(
    (a, b) => {
      const na = parseFloat(a);
      const nb = parseFloat(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    }
  );
}

/** Sibling that has `value` on `dim` and agrees with `current` on as many
 *  other dimensions as possible. */
export function bestMatch(current: Product, siblings: Product[], dim: string, value: string): Product | null {
  const candidates = siblings.filter((s) => s.attrs?.[dim] === value);
  if (candidates.length === 0) return null;
  const dims = dimsOf(siblings);
  const score = (s: Product) =>
    dims.reduce((n, d) => (d !== dim && s.attrs?.[d] === current.attrs?.[d] ? n + 1 : n), 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/** Group a product list by variantGroup (groups with 2+ members only). */
export function groupVariants(products: Product[]): Record<string, Product[]> {
  const groups: Record<string, Product[]> = {};
  for (const p of products) {
    if (!p.variantGroup) continue;
    (groups[p.variantGroup] ??= []).push(p);
  }
  for (const key of Object.keys(groups)) {
    if (groups[key].length < 2) delete groups[key];
  }
  return groups;
}
