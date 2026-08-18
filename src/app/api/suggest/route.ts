import { NextResponse } from "next/server";
import { searchTokens, matchesAll, normalizeSearchText, CATEGORY_INTENT } from "@/lib/search-normalize";
import { loadSearchSignals } from "@/lib/search-signals";
import { normalizeSearchText as lexNormalize, expandToken, singularize } from "@/lib/search-lexicon";
import { rankSearch } from "@/lib/search-rank";
import { rateLimited, requestIp } from "@/lib/rate-limit";

/**
 * Search-suggest API behind the Amazon-style header search.
 *
 * GET /api/suggest?q=hav mcb
 * → { terms: [{ label, q, cat? }], products: [{ id, name, brand, cat, price, image }] }
 *
 * Terms are synthesized from the live catalogue (we have no query logs):
 *   - brand completions ("havells")
 *   - category-scoped searches ("mcb in Switchgear"), Amazon's classic
 *   - frequent product-line phrases from matching names ("life line plus s3 hrfr")
 * Products are the top matches by sales, then recommendation flag.
 *
 * Cached at the CDN per query (s-maxage); the catalogue changes rarely.
 */

export const runtime = "nodejs";

const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

type Row = {
  gst_rate?: number | string | null; id: string; name: string; brand: string; category: string; elume_price: number; image_url: string | null; units_sold: number | null; is_recommended: boolean | null };

// PostgREST filter values: strip anything that could break the and/or syntax.
const safe = (w: string) => w.replace(/[^\p{L}\p{N}.+-]/gu, "");

export async function GET(request: Request) {
  if (rateLimited(`sug:${requestIp(request.headers)}`, 90, 60_000)) {
    return NextResponse.json({ terms: [], products: [] }, { status: 200 }); // degrade, don't error
  }
  const q = (new URL(request.url).searchParams.get("q") || "").trim().toLowerCase();
  if (!URL_ || !KEY) return NextResponse.json({ terms: [], products: [] }, { status: 200 });
  if (q.length < 2) return NextResponse.json({ terms: [], products: [] }, { status: 200 });

  const words = q.split(/\s+/).map(safe).filter((w) => w.length >= 1).slice(0, 6);
  if (!words.length) return NextResponse.json({ terms: [], products: [] }, { status: 200 });

  // Exact-code fast path (ASIN behaviour): a pasted ELIN / our SKU / brand
  // SKU resolves straight to its product, ahead of any word matching. Two
  // spellings tried: as typed, and whitespace-stripped ("r-fs 001" and
  // "rfs001" both reach "R-FS 001"). Pre-0116 databases (no elin column)
  // fall through silently to normal matching.
  const codeRaw = q.replace(/[^A-Za-z0-9 ._\/-]/g, "").trim();
  if (codeRaw.length >= 4 && /\d/.test(codeRaw)) {
    for (const cand of [...new Set([codeRaw, codeRaw.replace(/\s+/g, "")])]) {
      try {
        const cu = `${URL_}/rest/v1/products?select=id,name,brand,category,elume_price,image_url,units_sold,is_recommended,gst_rate&or=(elin.ilike.${encodeURIComponent(cand)},sku.ilike.${encodeURIComponent(cand)},brand_sku.ilike.${encodeURIComponent(cand)})&is_active=eq.true&limit=3`;
        const cr = await fetch(cu, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, next: { revalidate: 300 } });
        if (cr.ok) {
          const hits = (await cr.json()) as Row[];
          if (hits.length) {
            return NextResponse.json({
              terms: [],
              products: hits.map((r) => ({ id: r.id, name: r.name, brand: r.brand, cat: r.category, price: Number(r.elume_price), gstRate: r.gst_rate != null ? Number(r.gst_rate) : undefined, image: r.image_url })),
              exact: true,
            });
          }
        }
      } catch { /* fall through to word matching */ }
    }
  }
  // Learned signals from the query log (cached 10 min; empty when cold).
  const signals = await loadSearchSignals();
  const normQ = normalizeSearchText(q);
  // Normalised tokens do the REAL matching ("1 sqmm" == "1 sq mm" == "1.0 sq. mm").
  const tokens = searchTokens(q);

  // The DB pre-filter only needs to shortlist: use the distinctive alpha
  // words (unit tokens like "sqmm" and bare numbers cannot be matched
  // verbatim against the many spellings in the data). Precision comes from
  // the normalised token filter applied after the fetch.
  const dbWords = words.filter((w) => /[a-z]{3,}/i.test(w) && !/^(sqmm|mm2?|mtr|metre|meter)s?$/i.test(w)).slice(0, 3);
  // Lexicon widening: each shortlist word also fetches its trade synonyms
  // and singular form, so "isolators" pulls Isolator rows and "spd" pulls
  // "Surge Protection" rows into the candidate set.
  const per = (dbWords.length ? dbWords : words.slice(0, 2)).map((w) => {
    const alts = [...new Set([w, singularize(w), ...expandToken(lexNormalize(w)).map((e) => e.split(" ")[0])])]
      .map(safe)
      .filter((a) => a.length >= 3)
      .slice(0, 4);
    const ors = alts.flatMap((a) => [`name.ilike.*${a}*`, `brand.ilike.*${a}*`, `category.ilike.*${a}*`]);
    return `or(${ors.join(",")})`;
  });
  const filter = per.length === 1 ? per[0].replace(/^or/, "or=") : `and=(${per.join(",")})`;
  const url = `${URL_}/rest/v1/products?select=id,name,brand,category,elume_price,image_url,units_sold,is_recommended,gst_rate&${filter}&order=units_sold.desc.nullslast,id&limit=120`;

  let rows: Row[] = [];
  try {
    const r = await fetch(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, next: { revalidate: 300 } });
    if (r.ok) rows = (await r.json()) as Row[];
    // Precision pass: the same lexicon-aware ranker as the results page, so
    // the dropdown and the page never disagree about what matches.
    const ranked = rankSearch(
      q,
      rows.map((row) => ({ id: row.id, name: row.name, brand: row.brand, cat: row.category, unitsSold: Number(row.units_sold) || 0 }))
    );
    const keep = new Set(ranked.results.filter((r) => r.matchedWeight / r.totalWeight >= 0.55).map((r) => r.item.id));
    rows = keep.size ? rows.filter((row) => keep.has(row.id)) : rows.filter((row) => matchesAll(`${row.name} ${row.brand} ${row.category}`, tokens));
  } catch {
    /* suggest must never break the page; empty is fine */
  }

  /* ── rank product hits: learned picks > name-prefix > word-boundary ── */
  const queryPicks = signals.picksByQuery[normQ] ?? {};
  const score = (r: Row) => {
    const n = normalizeSearchText(r.name);
    let s = 0;
    // What people CHOSE after this exact query outranks everything.
    s += Math.min(queryPicks[r.id] ?? 0, 10) * 30;
    // Products picked from search anywhere get a damped global boost.
    s += Math.min(signals.pickTotals[r.id] ?? 0, 25) * 2;
    if (n.startsWith(normQ)) s += 100;
    for (const w of words) if (new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.+-]/g, "\\$&")}`, "iu").test(n)) s += 10;
    // Category intent, same rule as the results page: "wire" means the
    // Wires & Cables aisle, so the dropdown agrees with what search shows.
    for (const t of tokens) if (CATEGORY_INTENT[t] === r.category) { s += 40; break; }
    if (r.is_recommended) s += 5;
    s += Math.min(Number(r.units_sold) || 0, 50) / 10;
    // Photo rule (ranking.ts rule 2): the dropdown renders thumbnails, so an
    // imageless product only surfaces when nothing photographed matches.
    return s * (r.image_url ? 1 : 0.3);
  };
  const products = [...rows]
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
    .slice(0, 5)
    .map((r) => ({ id: r.id, name: r.name, brand: r.brand, cat: r.category, price: Number(r.elume_price), gstRate: r.gst_rate != null ? Number(r.gst_rate) : undefined, image: r.image_url }));

  /* ── text suggestions ── */
  const terms: { label: string; q: string; cat?: string }[] = [];
  const seen = new Set<string>();
  const add = (label: string, qq: string, cat?: string) => {
    const k = (label + (cat ?? "")).toLowerCase();
    if (seen.has(k) || terms.length >= 6) return;
    seen.add(k);
    terms.push({ label, q: qq, ...(cat ? { cat } : {}) });
  };

  // A learned spelling fix outranks everything: someone typed exactly this
  // before, got nothing, and found what they wanted with the corrected form.
  const fix = signals.corrections[normQ];
  if (fix) add(fix, fix);

  // LEARNED first: completions from what real visitors actually searched
  // (frequency-ranked, successful queries only). The list grows and reorders
  // itself as search volume accumulates.
  for (const pq of signals.popularQueries) {
    if (terms.length >= 3) break; // leave room for brand/category suggestions
    if (pq.q === q) continue;
    if (pq.q.startsWith(q) || normalizeSearchText(pq.q).startsWith(normQ)) add(pq.q, pq.q);
  }

  // Brand completions when the query looks like a brand prefix.
  for (const b of new Set(rows.map((r) => r.brand))) {
    if (b.toLowerCase().startsWith(q)) add(b.toLowerCase(), b);
  }

  // Frequent product-line phrases from the matching names (brand and colour
  // suffix stripped, first 4 words) stands in for query-log completions.
  const phrase = new Map<string, number>();
  for (const r of rows) {
    const base = r.name.replace(new RegExp(`^${r.brand}\\s+`, "i"), "").split("-")[0].trim().toLowerCase();
    const p = base.split(/\s+/).slice(0, 4).join(" ");
    if (p.length >= q.length && p.includes(words[0])) phrase.set(p, (phrase.get(p) ?? 0) + 1);
  }
  for (const [p, n] of [...phrase.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    if (n >= 2) add(p, p);
  }

  // Category-scoped searches, Amazon's "… in Department".
  const catCount = new Map<string, number>();
  for (const r of rows) catCount.set(r.category, (catCount.get(r.category) ?? 0) + 1);
  for (const [cat] of [...catCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)) {
    add(q, q, cat);
  }

  return NextResponse.json(
    { terms, products },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } }
  );
}
