import { slugify } from "@/lib/slug";

/**
 * Brand logo files rehosted under /public/brands (sourced from each brand's
 * own site favicon at 128px; Elume uses our own mark). Brands without a
 * usable logo render as a styled initial in the circle instead - never a
 * broken image.
 */
const HAVE = new Set([
  "havells", "kei", "rr-kabel", "finolex", "anchor", "atomberg", "crompton",
  "orient", "usha", "legrand", "schneider", "abb", "apar", "philips",
  "syska", "wipro", "cmi", "elume", "polycab", "norisys",
]);

export function brandLogo(brand: string): string | null {
  const s = slugify(brand);
  return HAVE.has(s) ? `/brands/${s}.png` : null;
}
