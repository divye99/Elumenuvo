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

/* ── Typo tolerance ──
 * Customers type "water moter", "gyser", "seimens". Strict token matching
 * returns 0 for all of them, and the search log shows people either fixing
 * the spelling themselves or leaving. When the STRICT search finds nothing,
 * each unmatched word is corrected to the closest word that actually occurs
 * in the catalogue, and the results page says what it searched for instead.
 * Correction never runs when strict matching succeeds, so exact SKU and
 * part-number searches are untouched. */

/** Bounded Damerau-Levenshtein distance (transposition counts 1, so
 *  "moter"→"motor" is a single edit). Returns max+1 when exceeded. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1; // early out: whole row over budget
  }
  return d[a.length][b.length];
}

/** word → occurrence count, from catalogue text. Frequency breaks ties, so a
 *  typo lands on the common word ("motor"), not an obscure one. */
export type SearchVocab = Map<string, number>;

export function buildSearchVocab(texts: Iterable<string>): SearchVocab {
  const vocab: SearchVocab = new Map();
  for (const t of texts) {
    for (const w of normalizeSearchText(t).split(/[^\p{L}]+/u)) {
      if (w.length >= 3) vocab.set(w, (vocab.get(w) ?? 0) + 1);
    }
  }
  return vocab;
}

/** Correct the tokens a strict search failed on. Only alphabetic words of 4+
 *  characters are candidates (numbers and unit tokens are never "typos"), and
 *  a word the catalogue already contains - even as a prefix - is left alone. */
export function correctSearchTokens(
  tokens: string[],
  vocab: SearchVocab
): { tokens: string[]; changed: boolean } {
  let changed = false;
  const out = tokens.map((t) => {
    if (!/^[\p{L}]{4,}$/u.test(t)) return t;
    if (vocab.has(t)) return t;
    for (const w of vocab.keys()) if (w.startsWith(t)) return t; // mid-typing, not a typo
    const budget = t.length <= 5 ? 1 : 2;
    let best: string | null = null;
    let bestDist = budget + 1;
    let bestCount = 0;
    for (const [w, count] of vocab) {
      const dist = editDistance(t, w, budget);
      if (dist < bestDist || (dist === bestDist && count > bestCount)) {
        if (dist <= budget) { best = w; bestDist = dist; bestCount = count; }
      }
    }
    if (best) { changed = true; return best; }
    return t;
  });
  return { tokens: out, changed };
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
  geyser: "Water Heaters", geysers: "Water Heaters", heater: "Water Heaters",
  heaters: "Water Heaters",
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
