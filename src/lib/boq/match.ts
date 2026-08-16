/**
 * The Smart BOM matcher - the homegrown core of the BOQ assistant (owner
 * moat, Aug 2026). Maps one parsed BOQ line to catalogue products with a
 * confidence score and ranked alternates. NO model calls: every layer is
 * deterministic and inspectable, and the whole thing improves from user
 * corrections via product_aliases.
 *
 * Layer order (first confident hit wins, later layers still fill alternates):
 *   1. CODE      - exact SKU / manufacturer catalogue number in the line
 *   2. ALIAS     - a phrasing users previously confirmed (product_aliases)
 *   3. FINGERPRINT - spec-level match via the compare engine's extractors
 *                  (size/polymer for wires, poles/amps for switchgear...)
 *   4. TOKENS    - normalized token relevance with typo correction
 * Confidence: code 0.98, alias 0.9+, fingerprint 0.75-0.9, tokens scaled by
 * relevanceScore. Below 0.35 the line reports as unmatched.
 */
import type { Product } from "@/lib/data";
import { normalizeSearchText, searchTokens, matchesAll, buildSearchVocab, correctSearchTokens, relevanceScore, CATEGORY_INTENT, type SearchVocab } from "@/lib/search-normalize";
import { fingerprintProduct, decodeEntities } from "@/lib/compare/fingerprint";
import { isMetalCategory } from "@/lib/metals";
import { canonicalUnit, type BoqParsedLine } from "./parse";

export type BoqCandidate = { id: string; score: number };
export type BoqMatch = {
  line: BoqParsedLine;
  productId: string | null;
  confidence: number;       // 0..1
  method: "code" | "alias" | "fingerprint" | "tokens" | null;
  alternates: BoqCandidate[]; // ranked, excludes the top pick
  /** Sell-unit quantity: for wires, metres converted to coils. */
  finalQty: number | null;
  qtyNote: string | null;   // e.g. "500 m -> 6 x 90 m coils"
};

/** Coil length in metres, resolved through the documented chain: attrs.Length,
 *  tech_specs "Standard Length in Coil", then name/spec regex, then the
 *  implicit 90 m import default for coil-unit rows. */
export function coilLengthMetres(p: Product): number | null {
  if (p.unit !== "coil") return null;
  const fromAttr = p.attrs?.Length?.match(/(\d{2,4})/)?.[1];
  if (fromAttr) return Number(fromAttr);
  const fromSpecs = p.techSpecs?.specs?.["Standard Length in Coil"]?.match(/(\d{2,4})/)?.[1];
  if (fromSpecs) return Number(fromSpecs);
  const fromText = `${p.name} ${p.spec}`.match(/\b(\d{2,4})\s*(?:m|mtr|metre|meter)s?\b(?!m)/i)?.[1];
  if (fromText) return Number(fromText);
  return 90; // the import pipeline's implicit default (gen-havells-import.mjs)
}

/** Alias map loaded once per request: alias_norm -> candidates by hits. */
export type AliasMap = Map<string, BoqCandidate[]>;

type Indexed = {
  p: Product;
  norm: string;          // normalized name+brand+spec head
  codeNorms: string[];   // normalized sku + brand_sku forms
  fpKey: string | null;  // fingerprint key
};

export type BoqIndex = {
  items: Indexed[];
  byCode: Map<string, string>;   // codeNorm -> product id
  byId: Map<string, Product>;
  vocab: SearchVocab;
};

const codeNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Build the in-memory matching index from the (cached) catalogue. */
export function buildBoqIndex(products: Product[]): BoqIndex {
  const items: Indexed[] = [];
  const byCode = new Map<string, string>();
  const byId = new Map<string, Product>();
  for (const p of products) {
    if (p.inStock === false) continue; // never match a BOQ to dead stock
    // Commodity metals (lakh-scale lots) are never what a BOQ line means -
    // "copper wire" is a house wire, not a CCR rod.
    if (isMetalCategory(p.cat)) continue;
    byId.set(p.id, p);
    const codes: string[] = [];
    for (const c of [p.sku, p.brandSku, p.elin]) {
      if (!c) continue;
      // Shopify brands store brand_sku as "handle::variantId" - not a code a
      // contractor would ever write; only index real catalogue numbers.
      if (c.includes("::")) continue;
      const n = codeNorm(String(c));
      if (n.length >= 5) { codes.push(n); byCode.set(n, p.id); }
    }
    const fp = fingerprintProduct({ name: decodeEntities(p.name), spec: p.spec, category: p.cat, attrs: p.attrs });
    items.push({
      p,
      norm: normalizeSearchText(`${p.brand} ${decodeEntities(p.name)} ${p.spec.slice(0, 160)}`),
      codeNorms: codes,
      fpKey: fp?.key ?? null,
    });
  }
  const vocab = buildSearchVocab(items.map((i) => i.norm));
  return { items, byCode, byId, vocab };
}

/** Convert the BOQ quantity into the matched product's sell unit. */
function sellQty(p: Product, line: BoqParsedLine): { qty: number | null; note: string | null } {
  if (line.qty == null) return { qty: null, note: null };
  const u = canonicalUnit(line.unit);
  if (p.unit === "coil" && u === "m") {
    const L = coilLengthMetres(p) ?? 90;
    const coils = Math.max(1, Math.ceil(line.qty / L));
    return { qty: coils, note: `${line.qty} m → ${coils} × ${L} m coil${coils > 1 ? "s" : ""}` };
  }
  if (p.unit === "coil" && (u === "coil" || u === "count" || u == null)) {
    return { qty: Math.max(1, Math.round(line.qty)), note: null };
  }
  return { qty: Math.max(1, Math.round(line.qty)), note: null };
}

/** BOQ vocabulary beyond the storefront's search intent: contractor lines
 *  say "switch"/"socket" (Modular) and "spike guard" (Extension Boards)
 *  where a shopper would type a brand or range name. */
const BOQ_INTENT: Record<string, string> = {
  switch: "Modular", switches: "Modular", socket: "Modular", sockets: "Modular",
  regulator: "Modular", dimmer: "Modular", plate: "Modular", plates: "Modular",
  spikeguard: "Extension Boards", spike: "Extension Boards", extension: "Extension Boards",
  tubelight: "Lighting", tubelights: "Lighting", panel: "Lighting", downlight: "Lighting",
  immersion: "Water Heaters",
};

/** Infer the catalogue category a line is talking about. Majority vote across
 *  ALL tokens (a line saying "copper wire" votes wire, not the Copper metals
 *  family - metals never appear in a BOQ), with the storefront intent map
 *  extended by BOQ vocabulary. */
function lineCategory(tokens: string[]): string | null {
  const votes = new Map<string, number>();
  for (const t of tokens) {
    const cat = CATEGORY_INTENT[t] ?? BOQ_INTENT[t];
    if (!cat || isMetalCategory(cat)) continue;
    votes.set(cat, (votes.get(cat) ?? 0) + 1);
  }
  let best: string | null = null, n = 0;
  for (const [cat, v] of votes) if (v > n) { best = cat; n = v; }
  return best;
}

export function matchBoqLine(line: BoqParsedLine, index: BoqIndex, aliases: AliasMap): BoqMatch {
  const text = decodeEntities(line.description);
  const norm = normalizeSearchText(text);

  // ── Layer 1: exact catalogue / manufacturer code anywhere in the line ──
  for (const word of text.split(/[\s,;|]+/)) {
    const n = codeNorm(word);
    if (n.length >= 5) {
      const hit = index.byCode.get(n);
      if (hit) {
        const p = index.byId.get(hit)!;
        const q = sellQty(p, line);
        return { line, productId: hit, confidence: 0.98, method: "code", alternates: [], finalQty: q.qty, qtyNote: q.note };
      }
    }
  }

  // ── Layer 2: learned alias for this exact normalized phrasing ──
  const aliasHits = aliases.get(norm);
  if (aliasHits?.length) {
    const [top, ...rest] = aliasHits;
    const p = index.byId.get(top.id);
    if (p) {
      const q = sellQty(p, line);
      return { line, productId: top.id, confidence: Math.min(0.97, 0.88 + top.score * 0.02), method: "alias", alternates: rest.slice(0, 5).filter((a) => index.byId.has(a.id)), finalQty: q.qty, qtyNote: q.note };
    }
  }

  // ── Layers 3+4 share the token machinery ──
  let tokens = searchTokens(norm);
  const corrected = correctSearchTokens(tokens, index.vocab);
  tokens = corrected.tokens;
  const cat = lineCategory(tokens);

  // Layer 3: spec fingerprint - category-gated structural match. The line is
  // fingerprinted AS IF it were a product of the inferred category; equal keys
  // are structural equality (size, polymer, poles, amps...), which survives
  // wording the token layer would miss ("FRLS" vs "LSH" dialects).
  let fpMatches: Indexed[] = [];
  if (cat) {
    const lineFp = fingerprintProduct({ name: text, spec: null, category: cat, attrs: {} });
    if (lineFp) {
      fpMatches = index.items.filter((i) => i.fpKey === lineFp.key);
      // Wires: the line's fingerprint carries no coil length (qty was stripped),
      // so key equality can fail on the length segment. Retry on a partial key:
      // same size + polymer, any length.
      if (!fpMatches.length && lineFp.key.startsWith("wires|")) {
        const [, size, , polymer] = lineFp.key.split("|");
        fpMatches = index.items.filter((i) => {
          if (!i.fpKey?.startsWith("wires|")) return false;
          const parts = i.fpKey.split("|");
          return parts[1] === size && parts[3] === polymer;
        });
      }
      // Switchgear: the key's trailing form-factor segment (din vs mini) is a
      // compare-engine safety gate a BOQ line never specifies - "MCB 32A SP C"
      // must match both Havells Mini and DIN series. Retry with the form
      // segment wildcarded (everything else must still be equal).
      if (!fpMatches.length && lineFp.key.startsWith("switchgear|")) {
        const prefix = lineFp.key.split("|").slice(0, -1).join("|") + "|";
        fpMatches = index.items.filter((i) => i.fpKey?.startsWith(prefix));
      }
    }
  }

  // Score the fingerprint pool (and the general pool) with token relevance so
  // brand words in the line ("polycab") rank the right maker first. A brand
  // named IN the line is the strongest human signal a BOQ carries - weight it
  // above everything except structural spec equality.
  const tokenSet = new Set(tokens);
  const scoreOf = (i: Indexed) => {
    const brandHit = i.p.brand.toLowerCase().split(/\s+/).some((w) => tokenSet.has(w));
    return relevanceScore({ name: i.p.name, brand: i.p.brand, cat: i.p.cat, spec: i.p.spec }, tokens) +
      (brandHit ? 25 : 0) + (i.p.image ? 2 : 0) + Math.min(i.p.unitsSold ?? 0, 50) / 25;
  };

  if (fpMatches.length) {
    const ranked = fpMatches.map((i) => ({ id: i.p.id, score: scoreOf(i) })).sort((a, b) => b.score - a.score);
    const p = index.byId.get(ranked[0].id)!;
    const q = sellQty(p, line);
    // Structural match + at least some token agreement = high confidence;
    // structural match alone (generic line, no brand) = solid but reviewable.
    const conf = ranked[0].score >= 40 ? 0.9 : ranked[0].score >= 10 ? 0.82 : 0.75;
    return { line, productId: ranked[0].id, confidence: conf, method: "fingerprint", alternates: ranked.slice(1, 6), finalQty: q.qty, qtyNote: q.note };
  }

  // Layer 4: token relevance over the whole catalogue (category-boosted).
  const pool = cat ? index.items.filter((i) => i.p.cat === cat) : index.items;
  const candidates = pool
    .filter((i) => tokens.length > 0 && matchesAll(i.norm, tokens.slice(0, 6)))
    .map((i) => ({ id: i.p.id, score: scoreOf(i) }));
  // Full-AND too strict? Relax to best partial coverage.
  const relaxed = candidates.length
    ? candidates
    : pool
        .map((i) => ({ id: i.p.id, score: scoreOf(i) }))
        .filter((c) => c.score >= 20);
  relaxed.sort((a, b) => b.score - a.score);

  if (relaxed.length) {
    const top = relaxed[0];
    const p = index.byId.get(top.id)!;
    const q = sellQty(p, line);
    const conf = Math.max(0.35, Math.min(0.8, top.score / 100));
    return { line, productId: top.id, confidence: conf, method: "tokens", alternates: relaxed.slice(1, 6), finalQty: q.qty, qtyNote: q.note };
  }

  return { line, productId: null, confidence: 0, method: null, alternates: [], finalQty: null, qtyNote: null };
}
