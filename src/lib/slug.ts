/** URL slugs for brand and category hub pages.
 *  "Wires & Cables" -> "wires-cables", "RR Kabel" -> "rr-kabel".
 *  Resolution works by slugifying the live values and comparing, so no
 *  hand-maintained mapping can drift out of date. */
export function slugify(v: string): string {
  return v.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function resolveSlug(slug: string, values: string[]): string | null {
  const s = slug.toLowerCase();
  return values.find((v) => slugify(v) === s) ?? null;
}
