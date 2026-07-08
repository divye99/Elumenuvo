/**
 * Auto-map our catalogue to the BRAND e-store sources (Havells, Crompton,
 * Atomberg, Syska own stores + BestOfElectricals distributor + HandyPanda).
 * Complements the earlier Vashi mapper (0013) — existing Vashi mappings stay.
 *
 *   node --env-file=.env.local scripts/auto-map-brands.mjs
 *     → writes supabase/migrations/0020_competitor-map-brands.sql
 *
 * Reads products via the anon REST API (public read, no service key needed).
 * Best-effort: brand-appropriate source(s) are searched per product, candidates
 * are type-guarded and token-scored; only confident matches are written.
 */
import fs from "fs";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "User-Agent": UA, Accept: "application/json" };

if (!SUPABASE_URL || !ANON) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."); process.exit(1); }

/* ── per-platform search: (q) → [{code,name,price}] ── */

function magentoSearch(base) {
  const F = "items{sku name url_key price_range{minimum_price{final_price{value}}}}";
  return async (q) => {
    try {
      const query = `query{products(search:${JSON.stringify(q)},pageSize:10){${F}}}`;
      const r = await fetch(`${base}/graphql?query=${encodeURIComponent(query)}`, { headers: H });
      if (!r.ok) return [];
      return ((await r.json())?.data?.products?.items ?? []).map((it) => ({ code: String(it.sku), name: String(it.name ?? ""), price: it.price_range?.minimum_price?.final_price?.value ?? null }));
    } catch { return []; }
  };
}

function shopifySearch(base) {
  return async (q) => {
    try {
      const r = await fetch(`${base}/search/suggest.json?q=${encodeURIComponent(q)}&resources%5Btype%5D=product&resources%5Blimit%5D=10`, { headers: H });
      if (!r.ok) return [];
      return ((await r.json())?.resources?.results?.products ?? []).map((p) => ({ code: String(p.handle), name: String(p.title ?? ""), price: p.price ?? null }));
    } catch { return []; }
  };
}

// BOE's search endpoint is weak, but its per-brand MANUFACTURER pages list the
// whole catalogue. We preload a brand's full catalogue once, then match locally
// (high recall) instead of searching. Brand → BOE manufacturer slug.
const BOE_SLUG = { havells: "havells", legrand: "legrand", anchor: "anchor", schneider: "schneider", abb: "abb", philips: "philips", wipro: "wipro", usha: "usha", hager: "hager", "gm modular": "gm-modular" };
const boeCache = new Map();

function parseBoeTiles(html) {
  const out = [];
  for (const b of html.split(/<div class=["']?product-item["']? data-productid=/).slice(1)) {
    const chunk = b.slice(0, 3000);
    const t = chunk.match(/<h2 class=["']?product-title["']?>\s*<a href=["']?([^ >"']+)["']?[^>]*>([^<]+)<\/a>/);
    const pr = chunk.match(/price actual-price["']?>([^<]+)</);
    if (t) out.push({ code: t[1].replace(/^\//, ""), name: t[2].trim().replace(/\s+/g, " "), price: pr ? Number(pr[1].replace(/Rs\.?|₹|,|\s/gi, "")) || null : null });
  }
  return out;
}

async function loadBoeBrand(brandLower) {
  if (boeCache.has(brandLower)) return boeCache.get(brandLower);
  const slug = BOE_SLUG[brandLower];
  if (!slug) { boeCache.set(brandLower, []); return []; }
  const all = new Map();
  for (let page = 1; page <= 30; page++) {
    const r = await fetch(`https://www.bestofelectricals.com/${slug}?pagenumber=${page}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) break;
    const items = parseBoeTiles(await r.text());
    const before = all.size;
    for (const it of items) all.set(it.code, it);
    if (all.size === before || items.length === 0) break;
    await sleep(250);
  }
  const list = [...all.values()];
  boeCache.set(brandLower, list);
  return list;
}

async function syskaSearch(q) {
  try {
    const r = await fetch("https://syska.co.in/", { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return [];
    const m = (await r.text()).match(/id="__DUKAAN_DATA__">([\s\S]*?)<\/script>/);
    if (!m) return [];
    const prods = [];
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === "object") {
        if (o.slug && o.selling_price != null && o.name) prods.push({ code: o.slug, name: o.name, price: o.selling_price });
        Object.values(o).forEach(walk);
      }
    };
    walk(JSON.parse(m[1]).DUKAAN_CATALOG ?? {});
    const ql = q.toLowerCase();
    const seen = new Set();
    return prods.filter((p) => p.name.toLowerCase().includes(ql)).filter((p) => (seen.has(p.code) ? false : (seen.add(p.code), true))).slice(0, 10);
  } catch { return []; }
}

const PINCODE = process.env.VASHI_PINCODE || "400001";
async function vashiSearch(q) {
  try {
    const url = `https://prodapi.vashiisl.com/occ/v2/visl/products/search?query=${encodeURIComponent(q)}&fields=FULL&currentPage=0&pageSize=10&lang=en&curr=INR`;
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", "X-Custom-Country": "IN", "X-Custom-Pincode": PINCODE, "X-Custom-Dealer": "" } });
    if (!r.ok) return [];
    return ((await r.json())?.products ?? []).map((p) => ({ code: String(p.code ?? ""), name: String(p.name ?? ""), price: p.price?.value ?? null })).filter((p) => p.code);
  } catch { return []; }
}

async function handypandaSearch(q) {
  try {
    const r = await fetch("https://www.handypanda.in/categories/electricals", { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return [];
    const slugs = [...new Set([...(await r.text()).matchAll(/\/products\/([a-z0-9-]+)/g)].map((m) => m[1]))];
    const qw = q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return slugs
      .map((s) => ({ code: s, name: s.replace(/-[a-z0-9]{6,8}$/, "").replace(/-/g, " "), price: null }))
      .filter((p) => qw.some((w) => p.name.includes(w)))
      .slice(0, 8);
  } catch { return []; }
}

/* ── source registry + which sources to try per product ── */
const SEARCHERS = {
  havells: magentoSearch("https://havells.com"),
  atomberg: magentoSearch("https://atomberg.com"),
  crompton: shopifySearch("https://www.crompton.co.in"),
  syska: syskaSearch,
  vashi: vashiSearch,
  handypanda: handypandaSearch,
  // bestofelectricals is handled via loadBoeBrand() (local catalogue match).
};
// A brand's own store, when we have an adapter for it (authoritative).
const OWN_STORE = { havells: "havells", crompton: "crompton", atomberg: "atomberg", syska: "syska" };
// Multi-brand sources are worth trying for everything (this is the "3-4 sites"
// fan-out). BOE spans all categories/brands; Vashi is industrial (switchgear,
// DB, wires); HandyPanda is consumer electrical.
const MULTI = ["bestofelectricals", "handypanda", "vashi"];

/** Candidate sources for a product = its own store (if any) + the multi-brand
 *  sites that plausibly carry its category. Wires keep their Vashi mapping from
 *  0013 (per-metre unit_factor), so we skip them here. */
function sourcesFor(p) {
  if (p.category === "Wires & Cables") return [];
  const out = new Set();
  const own = OWN_STORE[(p.brand || "").toLowerCase()];
  if (own) out.add(own);
  out.add("bestofelectricals");
  out.add("handypanda");
  if (p.category === "Switchgear" || p.category === "DB & Panels") out.add("vashi");
  return [...out];
}
const BRAND_DIRECT_SRC = new Set(Object.values(OWN_STORE));

/* ── scoring: type guard + normalized-token overlap ── */
const TYPE = {
  "Wires & Cables": /(sq\s*mm|sqmm|\bcore\b|frls|fr-?lsh?|house wire|flexible|cable|wire)/i,
  "Lighting": /\b(led|light|lamp|batten|panel|bulb|downlight|flood|street)\b/i,
  "Switchgear": /\b(mcb|rccb|rcbo|isolator|breaker|elcb|changeover|disconnector)\b/i,
  "DB & Panels": /\b(distribution board|\bdb\b|spn|tpn|enclosure)\b/i,
  "Modular": /\b(switch|socket|modular|regulator|dimmer|plate|frame|module|usb charger|bell push|twin)\b/i,
  "Fans": /\b(fan|bldc|sweep|exhaust)\b/i,
};

// Normalize the word-form zoo: "One Way"→"1way", "sq mm"→"sqmm", "6 A"→"6a"…
function normalize(s) {
  return s
    .toLowerCase()
    .replace(/mm²/g, " sqmm ")
    .replace(/sq\.?\s*mm/g, "sqmm")
    .replace(/\bone\b/g, "1").replace(/\btwo\b/g, "2").replace(/\bthree\b/g, "3").replace(/\bfour\b/g, "4").replace(/\bfive\b/g, "5")
    .replace(/(\d)\s*[- ]\s*(way|pin|module|step|gang|core)\b/g, "$1$2")
    .replace(/(\d(?:\.\d+)?)\s*(a|amp|amps)\b/g, "$1a")
    .replace(/(\d+)\s*(w|watt|watts)\b/g, "$1w");
}

// Distinguishing tokens — at least one MUST match for a confident mapping.
function hardTokens(s) {
  const t = new Set();
  for (const m of s.matchAll(/\b(\d+(?:\.\d+)?(?:\/\d+)?(?:a|w|way|pin|module|step|gang|core|sqmm))\b/g)) t.add(m[1]);
  for (const m of s.matchAll(/\b([a-z]\d{3,5}(?:\.\d{1,2})?)\b/g)) t.add(m[1]); // model codes (c5110.01)
  // Pole / DB configuration — "DP MCB" ≠ "SP MCB"; these discriminate strongly.
  for (const m of s.matchAll(/\b(spn|tpn|dpn|dp|sp|tp|fp|\dp)\b/g)) t.add(m[1]);
  return t;
}
const words = (x) => new Set(x.split(/[^a-z0-9.+]+/).filter((w) => w.length > 3 && !["with", "and", "for", "white"].includes(w)));

function score(p, cand) {
  const typeRe = TYPE[p.category];
  if (typeRe && !typeRe.test(cand.name)) return { s: -1, hard: 0 };
  const ourColour = (p.name.split("—")[1] || "").trim().toLowerCase();
  const a = normalize(`${p.name.split("—")[0]} ${p.spec ?? ""}`);
  const b = normalize(cand.name);
  const ha = hardTokens(a), hb = hardTokens(b);
  let s = 0, hard = 0;
  for (const t of ha) if (hb.has(t)) { s += t.match(/^[a-z]\d/) ? 6 : 3; hard++; }
  for (const w of words(a)) if (words(b).has(w)) s += 1;
  // Colour steering: grey products should land on grey variants and vice versa.
  const candGrey = /\bgrey\b/.test(b), ourGrey = /grey/.test(ourColour);
  if (ourGrey && candGrey) s += 2;
  if (!ourGrey && candGrey) s -= 2;
  return { s, hard };
}

/** Atomberg (and own stores generally) list FAMILY products ("Renesa + Ceiling
 *  Fan") without sizes — match series + fan-kind instead of tokens. */
function seriesMatch(p, cand) {
  const kind = (n) => (/exhaust/i.test(n) ? "exhaust" : /wall fan/i.test(n) ? "wall" : /pedestal/i.test(n) ? "pedestal" : "ceiling");
  const series = (n) =>
    normalize(n.split("—")[0])
      .replace(/\s*\+\s*/g, "+ ") // "renesa +" → "renesa+ "
      .split(/\s+/)
      .filter((w) => w && !["ceiling", "wall", "pedestal", "exhaust", "fan", "fans", "bldc", "smart"].includes(w) && !/^\d/.test(w))
      .join(" ")
      .trim();
  return kind(p.name) === kind(cand.name) && series(p.name) === series(cand.name);
}

// Type noun per category — the anchor word most catalogues share.
const TYPE_NOUN = {
  "Switchgear": /\b(mcb|rccb|rcbo|isolator|changeover|disconnector|elcb)\b/i,
  "DB & Panels": /\b(distribution board|enclosure|\bdb\b|kit kat)\b/i,
  "Modular": /\b(switch|socket|regulator|dimmer|plate|holder|bell push|module)\b/i,
  "Lighting": /\b(panel|batten|bulb|downlight|flood ?light|street ?light|light|lamp|luminaire)\b/i,
  "Fans": /\b(fan|regulator)\b/i,
};

/** A short, search-engine-friendly query: type noun + primary numeric spec
 *  ("Havells DP MCB 32A 'C' curve" → "MCB 32"). Magento/nopCommerce search is
 *  AND-over-tokens, so fewer, cleaner terms = far better recall. */
function coreQuery(p) {
  // Fans: own stores list by SERIES (Renesa, Aris), not size — query that word.
  if (p.category === "Fans") {
    const series = p.name.replace(/—.*/, "").split(/\s+/).slice(1) // drop brand
      .find((w) => w && !/^\d/.test(w) && !["ceiling", "wall", "pedestal", "exhaust", "fan", "fans", "bldc", "smart"].includes(w.toLowerCase()));
    return series ? series.replace(/\+$/, "") : "fan";
  }
  const re = TYPE_NOUN[p.category];
  const noun = re ? (p.name.match(re) || [])[0] : "";
  const num = (p.name.replace(/—.*/, "").match(/\b(\d+(?:\.\d+)?)\s*(?:a|w|mm|watt|amp|sqmm)?\b/i) || [])[1] || "";
  return `${noun || ""} ${num}`.trim();
}

/** Candidate list for one product on one source. */
async function candidatesFor(p, src, base) {
  // BOE: match against the brand's full preloaded catalogue (brand implied).
  if (src === "bestofelectricals") return loadBoeBrand((p.brand || "").toLowerCase());
  const brandDirect = BRAND_DIRECT_SRC.has(src);
  const brandPrefix = brandDirect ? "" : (p.brand || "").split(" ")[0] + " ";
  const core = coreQuery(p);
  const queries = [core && `${brandPrefix}${core}`, base && `${brandPrefix}${base}`.slice(0, 55)].filter(Boolean);
  const seen = new Set(), out = [];
  for (const q of queries) {
    for (const c of await SEARCHERS[src](q.trim())) if (!seen.has(c.code)) { seen.add(c.code); out.push(c); }
    await sleep(200);
    if (out.length >= 8) break;
  }
  return out;
}

/** Best confident candidate for one product on one source, or null. */
async function matchOnSource(p, src, base) {
  const brandDirect = BRAND_DIRECT_SRC.has(src);
  const boe = src === "bestofelectricals";
  const cands = await candidatesFor(p, src, base);
  let best = null;
  for (const c of cands) {
    // Multi-brand sources must name the brand; BOE catalogue is already per-brand.
    if (!brandDirect && !boe && !new RegExp(`\\b${(p.brand || "").split(" ")[0]}`, "i").test(c.name)) continue;
    if (brandDirect && p.category === "Fans" && seriesMatch(p, c)) return { c, s: 10 };
    const { s, hard } = score(p, c);
    if (hard >= 1 && s > (best?.s ?? 0)) best = { c, s };
  }
  return best && best.s >= 5 ? best : null;
}

async function main() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,category,spec,unit&order=sort_order&limit=2000`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const products = await r.json();
  if (!Array.isArray(products)) { console.error("Products read failed:", products); process.exit(1); }

  const rows = [];
  let multiSourceProducts = 0, noMatch = 0;
  for (const p of products) {
    if (String(p.id).startsWith("boe")) continue; // BOE imports are already self-mapped
    const sources = sourcesFor(p);
    if (sources.length === 0) continue;
    const base = p.name.split("—")[0].trim(); // drop the colour/variant suffix

    const hits = [];
    for (const src of sources) {
      const m = await matchOnSource(p, src, base);
      if (m) hits.push({ product_id: p.id, source: src, code: m.c.code, note: `auto: ${m.c.name.slice(0, 68)} (s${m.s})` });
    }
    if (hits.length >= 2) multiSourceProducts++;
    if (hits.length === 0) { noMatch++; console.log(`  ✗ ${p.brand} ${p.name.slice(0, 46)} — no source matched`); continue; }
    rows.push(...hits);
    console.log(`  ✓ ${p.brand} ${p.name.slice(0, 40)} → ${hits.map((h) => h.source).join(", ")} (${hits.length} seller${hits.length === 1 ? "" : "s"})`);
  }

  const sql = [
    "-- ═══════════════════════════════════════════════════════════════",
    "-- Auto-generated MULTI-SOURCE competitor mappings (scripts/auto-map-brands.mjs).",
    "-- Each product maps to every seller that carries it → the radar picks the",
    "-- lowest (Amazon-style). Complements 0013 (Vashi wires). Idempotent (upsert).",
    `-- ${rows.length} mappings across ${products.filter((p)=>!String(p.id).startsWith("boe")).length - noMatch} products;`,
    `-- ${multiSourceProducts} products have 2+ sellers; ${noMatch} unmatched.`,
    "-- ═══════════════════════════════════════════════════════════════",
    "",
    ...rows.map((m) =>
      `insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values (${[m.product_id, m.source, m.code].map((x) => `'${String(x).replace(/'/g, "''")}'`).join(", ")}, 1, '${m.note.replace(/'/g, "''")}')\n  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();`
    ),
    "",
    `select source, count(*) from public.competitor_map group by source order by source;`,
    "",
  ].join("\n");
  fs.writeFileSync("supabase/migrations/0022_competitor-map-multisource.sql", sql);
  console.log(`\nDone. ${rows.length} mappings; ${multiSourceProducts} products with 2+ sellers; ${noMatch} unmatched → supabase/migrations/0022_competitor-map-multisource.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
