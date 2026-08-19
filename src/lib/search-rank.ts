/**
 * Search ranking engine: lexicon-aware scoring + never-empty relaxation.
 *
 * Contract: rankSearch(query, items) returns items ordered best-first plus a
 * `relaxed` note when the engine had to drop query terms to find anything.
 * "No results" is not an outcome this engine produces for a non-empty
 * catalogue: it degrades from exact -> partial -> category-guess rather than
 * showing a dead end (owner rule, Aug 2026).
 *
 * Pure and framework-free: the same ranker serves the catalogue browser,
 * the suggest API and anything else that needs buyer-language matching.
 * Domain translation (units, shorthand, colours, plurals, typos) lives in
 * search-lexicon.ts; this file only scores.
 */
import {
  normalizeSearchText,
  weighQueryTokens,
  buildVocabulary,
  fuzzyCorrect,
  type WeightedToken,
} from "@/lib/search-lexicon";

export type Searchable = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  spec?: string | null;
  sku?: string;
  brandSku?: string;
  elin?: string;
  attrs?: Record<string, string> | null;
  unitsSold?: number | null;
};

export type RankedResult<T> = { item: T; score: number; matchedWeight: number; totalWeight: number };
export type RankOutcome<T> = {
  results: RankedResult<T>[];
  /** Set when the engine had to relax the query to avoid an empty page. */
  relaxed: null | { droppedTokens: string[]; note: string };
  /** Tokens the engine corrected ("izolator" -> "isolator"), for UI hints. */
  corrections: [string, string][];
};

/* ── Haystack construction (memoized per item by object identity) ──────── */
const HAYSTACKS = new WeakMap<object, { name: string; rest: string; all: string }>();

function haystack(item: Searchable): { name: string; rest: string; all: string } {
  const hit = HAYSTACKS.get(item as object);
  if (hit) return hit;
  const name = normalizeSearchText(item.name);
  const attrs = item.attrs ? Object.entries(item.attrs).map(([k, v]) => `${k} ${v}`).join(" ") : "";
  const rest = normalizeSearchText(
    [item.brand, item.cat, item.spec ?? "", attrs, item.sku ?? "", item.brandSku ?? "", item.elin ?? ""].join(" ")
  );
  const built = { name, rest, all: `${name} ${rest}` };
  HAYSTACKS.set(item as object, built);
  return built;
}

/* ── Matching one token against one product ───────────────────────────── */
function wholeWordIn(text: string, phrase: string): boolean {
  const i = text.indexOf(phrase);
  if (i < 0) return false;
  const before = i === 0 ? " " : text[i - 1];
  const afterIdx = i + phrase.length;
  const after = afterIdx >= text.length ? " " : text[afterIdx];
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

/** Score contribution of one token for one product; 0 = no match. */
function tokenScore(tok: WeightedToken, hay: { name: string; rest: string; all: string }): number {
  let best = 0;
  for (const exp of tok.expansions) {
    if (wholeWordIn(hay.name, exp)) {
      // Early-in-name beats late-in-name: "Havells Isolator FP" is an
      // isolator; "...DB suitable for MCB / RCCB / Isolator" merely hosts
      // one. The head of a product name is what the product IS.
      const pos = hay.name.indexOf(exp);
      best = Math.max(best, pos <= Math.max(12, hay.name.length * 0.35) ? 3.5 : 3);
      continue;
    }
    if (hay.name.includes(exp)) { best = Math.max(best, 2.2); continue; }
    if (wholeWordIn(hay.rest, exp)) { best = Math.max(best, 1.6); continue; }
    if (hay.rest.includes(exp)) { best = Math.max(best, 1.1); }
  }
  return best * tok.weight;
}

/* ── The ranker ────────────────────────────────────────────────────────── */
export function rankSearch<T extends Searchable>(query: string, items: T[]): RankOutcome<T> {
  const normalized = normalizeSearchText(query);
  let tokens = weighQueryTokens(normalized);
  const corrections: [string, string][] = [];

  if (tokens.length === 0) return { results: [], relaxed: null, corrections };

  // Fuzzy-correct tokens that match NOTHING anywhere in the catalogue.
  let vocab: Set<string> | null = null;
  tokens = tokens.map((tok) => {
    if (tok.kind !== "word" && tok.kind !== "family") return tok;
    const anywhere = items.some((it) => tokenScore(tok, haystack(it)) > 0);
    if (anywhere) return tok;
    if (!vocab) vocab = buildVocabulary(items.map((it) => haystack(it).all));
    const fix = fuzzyCorrect(tok.token, vocab);
    if (fix) {
      corrections.push([tok.token, fix]);
      return { ...tok, expansions: [...new Set([...tok.expansions, fix])] };
    }
    return tok;
  });

  const totalWeight = tokens.reduce((a, t) => a + t.weight, 0);

  const scored: RankedResult<T>[] = [];
  for (const item of items) {
    const hay = haystack(item);
    let score = 0;
    let matchedWeight = 0;
    for (const tok of tokens) {
      const s = tokenScore(tok, hay);
      if (s > 0) { score += s; matchedWeight += tok.weight; }
    }
    if (matchedWeight <= 0) continue;
    // Coverage is king: fraction of query weight matched dominates, so a
    // product matching "63 a" + "30 ma" + "rccb" + "dp" always beats one
    // matching just "rccb" - and a missing decorative word ("acr") cannot
    // sink an otherwise perfect variant match.
    const coverage = matchedWeight / totalWeight;
    // Deliberately NO popularity term here: relevance scores stay pure so
    // equally-specced products (three brands of "63 A 30 mA DP RCCB") tie
    // exactly and the CALLER's trend signal - glance views, purchases,
    // search picks, reviews - decides the order between brands.
    scored.push({ item, score: coverage * 100 + score, matchedWeight, totalWeight });
  }
  scored.sort((a, b) => b.score - a.score);

  // Strong results exist: return ONLY them. The weak tail (products sharing
  // one incidental word) used to inflate "3,626 results" for a query with
  // ten real answers; counts must mean what a buyer thinks they mean.
  const strong = scored.filter((r) => r.matchedWeight / r.totalWeight >= 0.55);
  if (strong.length > 0) return { results: strong, relaxed: null, corrections };

  // Relaxation: nothing covers most of the query. Whatever DOES match some
  // of it is still worth showing, ordered by how much they cover - with a
  // banner naming what we couldn't honour. True zero-match only happens for
  // queries alien to the whole catalogue; then the caller falls back to its
  // own default view (top sellers), still never an empty page.
  if (scored.length > 0) {
    const bestMatchedTokens = new Set<string>();
    const bestHay = haystack(scored[0].item);
    for (const tok of tokens) if (tokenScore(tok, bestHay) > 0) bestMatchedTokens.add(tok.token);
    const dropped = tokens.filter((t) => !bestMatchedTokens.has(t.token) && t.kind !== "stop").map((t) => t.token);
    return {
      results: scored,
      relaxed: {
        droppedTokens: dropped,
        note: dropped.length
          ? `Showing closest matches - nothing carries "${dropped.join(" ")}" exactly.`
          : "Showing closest matches.",
      },
      corrections,
    };
  }
  return { results: [], relaxed: { droppedTokens: [], note: "Showing popular products instead." }, corrections };
}
