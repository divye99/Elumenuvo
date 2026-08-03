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

/* ── Relevance ranking ──
 * Matching stays deliberately broad (recall: "wire" still substring-matches
 * "wireless", so nothing ever vanishes), but ORDER is earned: whole-word
 * name matches lead, spec-only and fuzzy matches sink to the bottom.
 * "havells wire" therefore shows wires first and doorbells last. */

/** Query words that unambiguously name a catalogue category. */
export const CATEGORY_INTENT: Record<string, string> = {
  wire: "Wires & Cables", wires: "Wires & Cables",
  cable: "Wires & Cables", cables: "Wires & Cables",
  mcb: "Switchgear", mcbs: "Switchgear", rccb: "Switchgear", rccbs: "Switchgear",
  rcbo: "Switchgear", switchgear: "Switchgear", changeover: "Switchgear",
  fan: "Fans", fans: "Fans",
  light: "Lighting", lights: "Lighting", lighting: "Lighting",
  bulb: "Lighting", bulbs: "Lighting", led: "Lighting", downlight: "Lighting",
  downlighter: "Lighting", batten: "Lighting", lamp: "Lighting",
  pump: "Pumps", pumps: "Pumps",
  copper: "Copper", ccr: "Copper", // Metals family (src/lib/metals.ts)
};

/** Does token t match a whole word (singular/plural tolerant)? */
function wordHit(words: string[], t: string): boolean {
  return words.some((w) => w === t || w === `${t}s` || t === `${w}s`);
}
function prefixHit(words: string[], t: string): boolean {
  return t.length >= 3 && words.some((w) => w.startsWith(t));
}

/**
 * Score how well a product matches the query tokens. 0 = substring-only
 * (weak) matches; higher = whole words in the name, right category.
 * Shared by the catalogue results page and the suggest API so both agree.
 */
export function relevanceScore(
  p: { name: string; brand: string; cat: string; spec?: string },
  tokens: string[]
): number {
  if (tokens.length === 0) return 0;
  const nameWords = normalizeSearchText(`${p.brand} ${p.name}`).split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
  const specWords = normalizeSearchText(p.spec ?? "").split(/[^\p{L}\p{N}.]+/u).filter(Boolean);
  const catNorm = normalizeSearchText(p.cat);

  let s = 0;
  let allWholeInName = true;
  for (const t of tokens) {
    if (wordHit(nameWords, t)) { s += 10; continue; }
    allWholeInName = false;
    if (prefixHit(nameWords, t)) { s += 5; continue; }   // "hav" → "havells"
    if (wordHit(specWords, t)) { s += 2; continue; }     // spec-sheet mention only
    s += 0;                                              // substring-only: recall, no rank
  }
  // Every token is a real word of the product's own name: strong signal.
  if (allWholeInName) s += 30;
  // Category intent: "wire" means the Wires & Cables aisle, hard.
  for (const t of tokens) {
    const wantCat = CATEGORY_INTENT[t];
    if (wantCat && normalizeSearchText(wantCat) === catNorm) s += 40;
  }
  return s;
}
