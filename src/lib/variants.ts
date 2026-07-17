import type { Product } from "@/lib/data";

/** Shared variant logic — used by the detail-page picker and the catalogue
 *  hover swatches. Variations point at their parent product via `parentId`;
 *  a family is the parent + all its children, differing by `attrs`. */

export const DIM_ORDER = ["Size", "Sweep", "Colour", "Length", "Quality"];

/** Swatch colours for known Colour/finish attr values. */
export const COLOUR_HEX: Record<string, string> = {
  Red: "#D93025",
  Blue: "#1A73E8",
  Black: "#202124",
  Yellow: "#F4B400",
  Green: "#188038",
  White: "#FFFFFF",
  Grey: "#9AA0A6",
  Brown: "#8B5E3C",
  // Atomberg fan finishes
  "Pearl White": "#F2F1EC",
  "Marble White": "#EFEFEA",
  "Midnight Black": "#1C1E22",
  "Matte Black": "#26282B",
  "Earth Brown": "#6B4A32",
  "Matte Brown": "#5E4633",
  "Ivory & Black": "#E8E4D5",
  "Metallic Gold": "#C9A24B",
  "Dark Teakwood": "#4E3423",
  "Sand Grey": "#B3AFA5",
  // Elume house-label palette (a palette of light)
  Ultraviolet: "#7A2FD1",
  "Solar Flare": "#FFC400",
  Aurora: "#12A15E",
  Ember: "#D93025",
  Midnight: "#25348F",
  Moonlight: "#F4F5F0",
  Eclipse: "#16181D",
  // Norisys modular finishes
  "Frost White": "#F4F5F7",
  "Quartz Grey": "#8D9299",
  "Charcoal Black": "#2B2E33",
  "Scarlet Red": "#C62828",
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

/** Family key for a product: its parent's id (or its own id if it IS the
 *  parent / standalone). */
export function familyKey(p: Product): string {
  return p.parentId ?? p.id;
}

/** Group a product list into variant families keyed by the parent id.
 *  A family = parent + children; families with fewer than 2 members are
 *  dropped (standalone products have no swatches/picker). */
export function groupVariants(products: Product[]): Record<string, Product[]> {
  const groups: Record<string, Product[]> = {};
  for (const p of products) {
    (groups[familyKey(p)] ??= []).push(p);
  }
  for (const key of Object.keys(groups)) {
    if (groups[key].length < 2) delete groups[key];
  }
  return groups;
}
