/**
 * Search lexicon: the domain knowledge layer under the storefront search.
 *
 * Why this exists (owner escalation, Aug 2026): real buyer queries like
 * "Havells Magnus 6 M Combined Plate ACR Glossy grey", "Apogee 1m 12switches
 * board slim plate", "RCCB Type A 63A DP 30mA", "4 sq mm 45 mts" and
 * "Isolators" were returning nothing or mis-ranked variants, even though the
 * catalogue carries exact or near matches. Buyers type from memory: units
 * glued to numbers, dealer shorthand (DP/FP/TPN), plural category words,
 * finish/colour words mixed up. This module translates that language into
 * the catalogue's language BEFORE any scoring happens.
 *
 * There is no public dataset for Indian FMEG search vocabulary; the feeds
 * that make this smart are (1) this hand-built trade lexicon, (2) the
 * vocabulary derived live from our own 9,000-listing catalogue (see
 * buildVocabulary), and (3) our search logs, which record what buyers typed
 * and what they picked. Everything here is pure and dependency-free so it
 * can run identically in the suggest API, the catalogue browser and the
 * BOQ matcher.
 */

/* ── Token-level synonym expansions ──────────────────────────────────────
 * Key: canonical lowercase query token → alternates that should be tried
 * against the product haystack. Multi-word alternates are matched as
 * substrings of the normalized haystack. Keep every alternate lowercase. */
export const SYNONYMS: Record<string, string[]> = {
  // Switchgear families
  isolator: ["isolator", "switch disconnector", "disconnector"],
  rccb: ["rccb", "rcd", "residual current"],
  elcb: ["rccb", "elcb", "residual current"],
  rcbo: ["rcbo"],
  mcb: ["mcb", "miniature circuit breaker"],
  mccb: ["mccb", "moulded case"],
  spd: ["spd", "surge protection", "surge protective", "surge protector", "surge suppressor"],
  surge: ["surge", "spd"],
  changeover: ["changeover", "change over", "cob"],
  // Poles - dealer shorthand both directions
  sp: ["sp", "1 pole", "single pole", "1p"],
  dp: ["dp", "2 pole", "double pole", "2p"],
  tp: ["tp", "3 pole", "triple pole", "3p"],
  fp: ["fp", "4 pole", "four pole", "4p"],
  spn: ["spn"],
  tpn: ["tpn"],
  pole: ["pole"],
  // SPD / RCCB types: "type 2" stays a phrase (see PHRASES) but t2 helps
  t1: ["t1", "type 1"],
  t2: ["t2", "type 2"],
  t3: ["t3", "type 3"],
  // Wiring + electrical accessories
  wire: ["wire", "cable"],
  cable: ["cable", "wire"],
  db: ["db", "distribution board"],
  switchboard: ["switch board", "switchboard"],
  regulator: ["regulator"],
  geyser: ["geyser", "water heater"],
  heater: ["heater", "geyser"],
  batten: ["batten", "tube light", "tubelight"],
  tubelight: ["batten", "tube light", "tubelight"],
  bulb: ["bulb", "lamp"],
  plate: ["plate", "cover plate", "outer plate", "combined plate", "front plate"],
  board: ["board", "plate", "switch board"],
  extension: ["extension", "spike"],
  spikeguard: ["spike", "surge"],
  holder: ["holder", "batten holder", "lamp holder"],
  fan: ["fan"],
  exhaust: ["exhaust", "ventilation", "ventilair"],
  // Colours: catalogue names use specific shades; map the generic word to
  // every shade family we stock so "grey" finds "Steel Grey" etc.
  grey: ["grey", "gray", "steel grey", "silver grey", "slate"],
  gray: ["grey", "gray", "steel grey", "silver grey", "slate"],
  black: ["black", "matt black", "glossy black", "granite black"],
  white: ["white", "matt white", "glossy white", "pearl white"],
  gold: ["gold", "golden", "champagne"],
  silver: ["silver", "silver grey"],
  wood: ["wood", "walnut", "teak", "oak"],
  // Finishes
  glossy: ["glossy", "gloss"],
  matt: ["matt", "matte", "satin"],
  // Generic trade words that should match broadly
  socket: ["socket"],
  switch: ["switch"],
  modular: ["modular"],
  slim: ["slim"],
  smart: ["smart"],
  led: ["led"],
  ac: ["ac"],
};

/* Query words that carry almost no matching signal on their own; they never
 * disqualify a product and score at the lowest weight. */
export const STOPWORDS = new Set([
  "the", "a", "an", "for", "of", "with", "and", "or", "in", "on", "at",
  "type", "series", "range", "new", "best", "price", "buy", "online",
]);

/* Multi-word phrases to fold into single tokens BEFORE tokenizing, so
 * "type 2" doesn't dissolve into a stopword + a number. */
const PHRASES: [RegExp, string][] = [
  [/\btype\s*([123])\b(?!\s*\+)/g, "t$1"],          // "type 2" -> t2 (not "type 1+2")
  [/\btype\s*([123])\s*\+\s*([123])\b/g, "t$1plus$2"], // "type 1+2" -> t1plus2
  [/\btype\s*a\b/g, "typea"],
  [/\btype\s*ac\b/g, "typeac"],
  [/\bsq\.?\s*mm\b|\bsqmm\b|\bmm2\b|\bmm²\b/g, "sqmm"],
  [/\bsingle\s+pole\b/g, "sp"],
  [/\bdouble\s+pole\b/g, "dp"],
  [/\btriple\s+pole\b/g, "tp"],
  [/\bfour\s+pole\b/g, "fp"],
  [/\bwater\s+heater\b/g, "geyser"],
  [/\bcover\s+plate\b|\bouter\s+plate\b|\bcombined\s+plate\b/g, "plate"],
];

/* ── Normalization ─────────────────────────────────────────────────────── */

/** Split glued number-unit tokens and canonicalize units.
 *  "63a"->"63 a", "30ma"->"30 ma", "12switches"->"12 m", "45mts"->"45 m",
 *  "1.5sqmm"->"1.5 sqmm", "6m"->"6 m". Also used on the haystack so both
 *  sides speak the same language. */
export function normalizeSearchText(input: string): string {
  let s = ` ${input.toLowerCase()} `;
  s = s.replace(/[|,/\u00b7-]+/g, " ");
  for (const [re, sub] of PHRASES) s = s.replace(re, sub);
  // Glued digit->letters boundary gets a space: 63a, 30ma, 12switches, 6m
  s = s.replace(/(\d(?:\.\d+)?)([a-z])/g, "$1 $2");
  // Letters->digit boundary too: m6 stays (SKU-ish), skip.
  // Unit canonicalization (post-split, units are standalone tokens)
  s = s.replace(/(\d(?:\.\d+)?)\s+(?:mts?|mtrs?|meters?|metres?)\b/g, "$1 m");
  s = s.replace(/(\d+)\s+(?:switches|switch|modules|module|mod)\b/g, "$1 m");
  s = s.replace(/(\d(?:\.\d+)?)\s+(?:amps?|amperes?)\b/g, "$1 a");
  s = s.replace(/(\d+)\s+(?:milliamps?|milli amps?)\b/g, "$1 ma");
  s = s.replace(/(\d+)\s+(?:watts?)\b/g, "$1 w");
  s = s.replace(/(\d+)\s+(?:ways?)\b/g, "$1 way");
  s = s.replace(/(\d+)\s+(?:litres?|liters?|ltrs?)\b/g, "$1 l");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Singularize a plain word (isolators -> isolator, switches -> switch). */
export function singularize(word: string): string {
  if (word.length > 3 && word.endsWith("ches")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("sses")) return word.slice(0, -2);
  if (word.length > 2 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** All match-strings to try for one normalized query token. */
export function expandToken(token: string): string[] {
  const out = new Set<string>([token]);
  const sing = singularize(token);
  out.add(sing);
  for (const t of [token, sing]) {
    const syn = SYNONYMS[t];
    if (syn) for (const s of syn) out.add(s);
  }
  return [...out];
}

/* ── Token weighting ─────────────────────────────────────────────────────
 * Spec-bearing tokens are what the buyer actually means; generic adjectives
 * are decoration. Weights drive both scoring and the relaxation order when
 * nothing matches everything. */
export type WeightedToken = { token: string; expansions: string[]; weight: number; kind: string };

export function weighQueryTokens(normalizedQuery: string): WeightedToken[] {
  const rawTokens = normalizedQuery.split(" ").filter(Boolean);
  const tokens: WeightedToken[] = [];
  for (let i = 0; i < rawTokens.length; i++) {
    const t = rawTokens[i];
    // Stitch number+unit pairs into one token ("63 a" -> "63 a")
    const next = rawTokens[i + 1];
    if (/^\d+(\.\d+)?$/.test(t) && next && ["a", "ma", "m", "w", "way", "sqmm", "kg", "l"].includes(next)) {
      const unit = next;
      const phrase = `${t} ${unit}`;
      tokens.push({ token: phrase, expansions: [phrase], weight: unit === "sqmm" || unit === "ma" ? 5 : 4, kind: "spec" });
      i++;
      continue;
    }
    if (STOPWORDS.has(t)) { tokens.push({ token: t, expansions: [t], weight: 0.25, kind: "stop" }); continue; }
    if (/^\d+(\.\d+)?$/.test(t)) { tokens.push({ token: t, expansions: [t], weight: 2, kind: "number" }); continue; }
    if (/^t[123](plus[123])?$/.test(t)) { tokens.push({ token: t, expansions: expandToken(t), weight: 5, kind: "spec" }); continue; }
    if (t === "typea" || t === "typeac") { tokens.push({ token: t, expansions: [t.replace("type", "type ")], weight: 1.5, kind: "spec-soft" }); continue; }
    if (["sp", "dp", "tp", "fp", "spn", "tpn"].includes(t)) { tokens.push({ token: t, expansions: expandToken(t), weight: 4, kind: "spec" }); continue; }
    if (SYNONYMS[t] || SYNONYMS[singularize(t)]) {
      const isColour = ["grey", "gray", "black", "white", "gold", "silver", "wood"].includes(t);
      const isFinish = ["glossy", "matt"].includes(t);
      const kind = isColour ? "colour" : isFinish ? "finish" : "family";
      tokens.push({ token: t, expansions: expandToken(t), weight: isColour ? 3 : isFinish ? 1.2 : 3, kind });
      continue;
    }
    tokens.push({ token: t, expansions: expandToken(t), weight: 2, kind: "word" });
  }
  return tokens;
}

/* ── Catalogue vocabulary + fuzzy correction ───────────────────────────── */

/** Build the set of words the catalogue actually uses (call once per
 *  catalogue load and memoize by product count). */
export function buildVocabulary(haystacks: string[]): Set<string> {
  const vocab = new Set<string>();
  for (const h of haystacks) {
    for (const w of h.split(/[^a-z0-9.]+/)) {
      if (w.length >= 3 && !/^\d+$/.test(w)) vocab.add(w);
    }
  }
  return vocab;
}

/** Damerau-ish edit distance, capped at 2 for speed. */
function editDistanceLe2(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 2) return false;
  const dp: number[] = [];
  for (let j = 0; j <= b.length; j++) dp[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    let rowMin = dp[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
      if (dp[j] < rowMin) rowMin = dp[j];
    }
    if (rowMin > 2) return false;
  }
  return dp[b.length] <= 2;
}

/** Correct one unknown word to the closest catalogue word (or null). Only
 *  called for tokens that matched nothing, so cost stays negligible. */
export function fuzzyCorrect(word: string, vocab: Set<string>): string | null {
  if (word.length < 4 || vocab.has(word)) return null;
  let best: string | null = null;
  for (const v of vocab) {
    if (v[0] !== word[0] && v[1] !== word[1]) continue; // cheap prefilter
    if (editDistanceLe2(word, v)) {
      if (best === null || Math.abs(v.length - word.length) < Math.abs(best.length - word.length)) best = v;
    }
  }
  return best;
}
