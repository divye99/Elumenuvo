/** Shared search-text normalisation (client + server).
 *
 *  Electrical sizes are written a dozen ways: "1 sq mm", "1.0 sq. mm",
 *  "1sqmm", "1 mm2", "1 mm²". Customers type yet another ("1 sqmm").
 *  Both the query and the haystack are folded to one canonical form so
 *  "elume 1 sqmm" finds "Elume FR House Wire 1 sq mm".
 */

export function normalizeSearchText(s: string): string {
  return s
    .toLowerCase()
    .replace(/mm²|mm2\b/g, "sqmm")
    .replace(/sq\.?\s*mm/g, "sqmm")
    // "1sqmm" → "1 sqmm" so number and unit are separate, comparable tokens
    .replace(/(\d)(sqmm)/g, "$1 $2")
    // "1.0" and "1" are the same size
    .replace(/(\d+)\.0+\b/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Query → normalised tokens; every token must appear in the normalised haystack. */
export function searchTokens(q: string): string[] {
  return normalizeSearchText(q).split(/\s+/).filter(Boolean);
}

export function matchesAll(haystack: string, tokens: string[]): boolean {
  const hay = normalizeSearchText(haystack);
  return tokens.every((t) => {
    // Bare numbers must match as whole tokens: a query for "1" (as in
    // "1 sqmm") must not match the 1 inside "180 m" or "1100 v".
    if (/^\d+(?:\.\d+)?$/.test(t)) {
      return new RegExp(`(^|[^\\d.])${t.replace(".", "\\.")}($|[^\\d.])`).test(hay);
    }
    return hay.includes(t);
  });
}
