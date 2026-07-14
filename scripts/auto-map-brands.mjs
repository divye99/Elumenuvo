/**
 * Auto-map our catalogue to competitor sources — LAYERED (v2):
 *
 *   Layer 1 · BRAND SKU (MPN)  — if products.brand_sku is set and a candidate's
 *             code/name contains it, that's an exact cross-site match →
 *             match_method='brand-sku', approval='approved' (trusted).
 *   Layer 1.5 · NAME MATCHER   — the existing type-guarded token/trigram scorer →
 *             match_method='name', approval='pending' (admin must approve in
 *             /admin/products or /admin/radar before it counts for pricing).
 *
 *   node --env-file=.env.local scripts/auto-map-brands.mjs
 *     → with SUPABASE_SERVICE_ROLE_KEY: upserts straight into competitor_map,
 *       SKIPPING pairs that already exist (manual + approved work is never
 *       overwritten), and prints a report.
 *     → without it: writes supabase/migrations/0028_competitor-map-v2.sql
 *       for you to review + run by hand.
 *
 * Fill brand_sku first (scripts/fill-brand-sku.mjs) — the more products carry
 * their MPN, the more mappings land in the trusted brand-sku layer.
 */
import fs from "fs";
import { FETCHERS } from "./lib/competitor-fetchers.mjs";

// Bound every fetch — a hung competitor connection (ETIMEDOUT after ~75s) was
// crashing the whole run. 20s cap; callers already treat failures as "no match".
const _fetch = globalThis.fetch;
globalThis.fetch = (u, o = {}) => _fetch(u, { ...o, signal: o.signal ?? AbortSignal.timeout(20000) });

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(); // enables direct DB writes
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const H = { "User-Agent": UA, Accept: "application/json" };

if (!SUPABASE_URL || !(ANON || SERVICE)) { console.error("Missing SUPABASE_URL + an API key (anon or service-role)."); process.exit(1); }
const READ_KEY = SERVICE || ANON;
console.log(`auto-map-brands v2 · node ${process.version} · mode: ${SERVICE ? "direct DB write" : "SQL file"}`);

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
    let items;
    try {
      const r = await fetch(`https://www.bestofelectricals.com/${slug}?pagenumber=${page}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
      if (!r.ok) break;
      items = parseBoeTiles(await r.text());
    } catch { break; } // timeout/network — use whatever we've collected so far
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
  orient: shopifySearch("https://orientelectric.com"),
  syska: syskaSearch,
  vashi: vashiSearch,
  handypanda: handypandaSearch,
  // bestofelectricals is handled via loadBoeBrand() (local catalogue match).
};
// A brand's own store, when we have an adapter for it (authoritative).
const OWN_STORE = { havells: "havells", crompton: "crompton", atomberg: "atomberg", syska: "syska", orient: "orient" };
// Multi-brand sources are worth trying for everything (this is the "3-4 sites"
// fan-out). BOE spans all categories/brands; Vashi is industrial (switchgear,
// DB, wires); HandyPanda is consumer electrical.
const MULTI = ["bestofelectricals", "handypanda", "vashi"];

// Brands whose single-core house wires Vashi stocks (per METRE → ×90 for a 90 m coil).
const VASHI_WIRE_BRANDS = new Set(["polycab", "finolex", "kei", "rr kabel"]);

// Optional scoping:
//   SKIP_SOURCES=havells,crompton  never map these sources this run (e.g. the
//     own store already has exact SKU mappings from a catalogue import)
//   ONLY_BRAND=Havells             only process this brand's products
//   EXTRA_ROWS_FILE=path.json      append product rows not in the DB yet
//     (a generated import that has not been applied), same shape as the
//     products select below.
const SKIP_SOURCES = new Set((process.env.SKIP_SOURCES || "").split(",").map((s) => s.trim()).filter(Boolean));
const ONLY_BRAND = (process.env.ONLY_BRAND || "").trim().toLowerCase();

/** Candidate sources for a product = its own store (if any) + the multi-brand
 *  sites that plausibly carry its category. */
function sourcesFor(p) {
  const brand = (p.brand || "").toLowerCase();
  const out = new Set();
  if (p.category === "Wires & Cables") {
    if (OWN_STORE[brand]) out.add(OWN_STORE[brand]); // Havells wires on havells.com
    if (VASHI_WIRE_BRANDS.has(brand)) out.add("vashi"); // Polycab/KEI/Finolex/RR on Vashi
    if (BOE_SLUG[brand]) out.add("bestofelectricals");
  } else {
    if (OWN_STORE[brand]) out.add(OWN_STORE[brand]);
    out.add("bestofelectricals");
    out.add("handypanda");
    if (p.category === "Switchgear" || p.category === "DB & Panels") out.add("vashi");
  }
  for (const s of SKIP_SOURCES) out.delete(s);
  return [...out];
}
const BRAND_DIRECT_SRC = new Set(Object.values(OWN_STORE));

/* ── Coil length: part of a wire's IDENTITY, not a detail ──
 * A 90 m coil and a 180 m coil of the same wire are different SKUs at roughly
 * 2x the price. Matching across them silently doubles (or halves) the
 * competitor price, so length is read from the product's own attributes and
 * enforced as a hard conflict in score(), and it drives the per-metre factor. */
const LENGTH_RE = /\b(\d{2,4})\s*(?:m|mtr|mtrs|meter|meters|metre|metres)\b/g;
function lengthsIn(s) {
  const out = new Set();
  for (const m of String(s).toLowerCase().matchAll(LENGTH_RE)) out.add(parseInt(m[1], 10));
  return out;
}
/** Our coil length in metres. attrs.Length is the source of truth (the same
 *  field the admin's unit-factor guess reads); name/spec are the fallback. */
function coilMetres(p) {
  const fromAttr = lengthsIn(p.attrs?.Length ?? "");
  if (fromAttr.size) return [...fromAttr][0];
  const fromText = lengthsIn(`${p.name} ${p.spec ?? ""}`);
  return fromText.size ? [...fromText][0] : null;
}

// Vashi quotes wire per METRE, so the factor is our actual coil length (90 m
// coil = x90, 180 m coil = x180). Hardcoding 90 priced a 180 m coil as if it
// were half a coil. Everything else is sold per unit.
function unitFactorFor(p, src) {
  if (p.category !== "Wires & Cables" || src !== "vashi") return 1;
  return coilMetres(p) ?? 90;
}

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
    .replace(/mm²/g, "sqmm")
    .replace(/(\d(?:\.\d+)?)\s*sq\.?\s*mm/g, "$1sqmm") // "2.5 sq mm" → "2.5sqmm" (a hard token)
    .replace(/sq\.?\s*mm/g, "sqmm")
    .replace(/\bsingle\b/g, "1") // "single core" ↔ "1 core"
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

// Character-trigram Dice similarity — catches marketing-name variants that share
// no numeric token (e.g. "Ambrose Decorative Fan" ~ "Ambrose HS Decorative Fan").
function trigrams(s) {
  const x = ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const g = new Set();
  for (let i = 0; i < x.length - 2; i++) g.add(x.slice(i, i + 3));
  return g;
}
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}
// Strip the brand + generic type words so similarity compares the distinctive bits.
function distinctive(name, brand) {
  return normalize(name.split("—")[0])
    .replace(new RegExp(`\\b${(brand || "").toLowerCase()}\\b`, "g"), "")
    .replace(/\b(ceiling|wall|pedestal|exhaust|fan|fans|bldc|smart|led|light|series|the)\b/g, " ")
    .trim();
}

/* Dimension families: if BOTH sides state a value for the same family and the
 * values disagree, the products are DIFFERENT — reject outright. This is what
 * stops "Polycab 4 sqmm 1 core" matching "Polycab 4 sqmm 6 core flexible":
 * the shared 4sqmm used to outvote the conflicting core count. */
const DIM_FAMILIES = ["sqmm", "core", "a", "w", "way", "pin", "module", "gang", "mm"];
function dimValues(s) {
  const out = {};
  for (const m of s.matchAll(/\b(\d+(?:\.\d+)?)(sqmm|core|a|w|way|pin|module|gang|mm)\b/g)) {
    const fam = m[2];
    (out[fam] ??= new Set()).add(parseFloat(m[1])); // parseFloat: "4.0" == "4"
  }
  return out;
}
function dimsConflict(a, b) {
  const da = dimValues(a), db = dimValues(b);
  for (const fam of DIM_FAMILIES) {
    if (!da[fam] || !db[fam]) continue; // one side silent → no conflict
    if (![...da[fam]].some((v) => db[fam].has(v))) return fam; // both speak, zero overlap
  }
  return null;
}

/* Device type: when BOTH names state one and they differ, the products are
 * different regardless of shared spec tokens. This is what stops a "20 A
 * Motor Starter" matching a "20A C-Curve MCB" on the shared amperage.
 * Order matters: specific types before generic ones ("Motor Starter Switch"
 * must resolve to motor-starter, not switch). */
const DEVICE_TYPES = [
  ["rcbo", /\brcbo\b/i],
  ["rccb", /\brccb\b|residual current/i],
  ["mcb", /\bmcb\b|miniature circuit/i],
  ["isolator", /isolator|disconnector/i],
  ["motor-starter", /motor starter/i],
  ["changeover", /changeover/i],
  ["contactor", /contactor/i],
  ["surge", /surge|spike guard|\bspd\b/i],
  ["db", /distribution board|\bdb\b|enclosure/i],
  ["fan", /\bfans?\b/i],
  ["pump", /pump/i],
  ["geyser", /geyser|water heater/i],
  ["socket", /socket|plug top/i],
  ["regulator", /regulator|dimmer/i],
  ["switch", /\bswitch(es)?\b/i],
];
function deviceType(name) {
  for (const [t, re] of DEVICE_TYPES) if (re.test(name)) return t;
  return null;
}
function deviceConflict(a, b) {
  const ta = deviceType(a), tb = deviceType(b);
  return !!(ta && tb && ta !== tb);
}

function score(p, cand) {
  const typeRe = TYPE[p.category];
  if (typeRe && !typeRe.test(cand.name)) return { s: -1, hard: 0, sim: 0 };
  const ourColour = (p.name.split("—")[1] || "").trim().toLowerCase();
  let a = normalize(`${p.name.split("—")[0]} ${p.spec ?? ""}`);
  const b = normalize(cand.name);
  // House wire is single-core by definition — make that explicit on OUR side even
  // when the listing doesn't say it, so a multi-core candidate becomes a conflict.
  if (p.category === "Wires & Cables" && !/\d\s*core/.test(a)) a += " 1core";
  // Conflicting spec dimension (core count, size, amperage…) → different product.
  if (dimsConflict(a, b)) return { s: -1, hard: 0, sim: 0 };
  // Conflicting device type (motor starter vs MCB…) → different product.
  if (deviceConflict(p.name, cand.name)) return { s: -1, hard: 0, sim: 0 };
  // Wires: the sqmm size is the product's identity — the candidate must state
  // the SAME size, not merely avoid contradicting it.
  if (p.category === "Wires & Cables") {
    const ourSize = a.match(/\b(\d+(?:\.\d+)?)sqmm\b/);
    const candSize = b.match(/\b(\d+(?:\.\d+)?)sqmm\b/);
    if (ourSize && (!candSize || parseFloat(candSize[1]) !== parseFloat(ourSize[1]))) return { s: -1, hard: 0, sim: 0 };
    // Insulation grade is a real product difference (FRLS ≠ FR-LSH ≠ FR ≠ HRFR
    // ≠ ZHFR — different compound, different price). If both sides state a
    // grade and they differ, reject.
    const grade = (x) => {
      const c = x.replace(/\bhr[\s-]?fr\b/g, "hrfr").replace(/\bfr[\s-]?lsh\b/g, "frlsh").replace(/\bfr[\s-]?ls\b/g, "frls");
      return new Set([...c.matchAll(/\b(frlsh|frls|hrfr|zhfr|hffr|fr)\b/g)].map((m) => m[1]));
    };
    const ga = grade(a), gb2 = grade(b);
    if (ga.size && gb2.size && ![...ga].some((g) => gb2.has(g))) return { s: -1, hard: 0, sim: 0 };
    // Coil length: if the listing states one and it isn't ours, it's a different
    // pack. This is what stopped a 90 m coil matching a 180 m coil (and picking
    // up ~2x the price as if it were like-for-like). A listing that states no
    // length is not penalised: per-metre sellers (Vashi) never state one, and
    // the unit factor handles them.
    const ourLen = coilMetres(p);
    const candLens = lengthsIn(cand.name);
    if (ourLen && candLens.size && !candLens.has(ourLen)) return { s: -1, hard: 0, sim: 0 };
  }
  const ha = hardTokens(a), hb = hardTokens(b);
  let s = 0, hard = 0;
  for (const t of ha) if (hb.has(t)) { s += t.match(/^[a-z]\d/) ? 6 : 3; hard++; }
  for (const w of words(a)) if (words(b).has(w)) s += 1;
  // Fuzzy name similarity on the distinctive parts (series/model words).
  const sim = dice(trigrams(distinctive(p.name, p.brand)), trigrams(distinctive(cand.name, p.brand)));
  s += Math.round(sim * 6); // up to +6 for a near-identical name
  // Colour steering: grey products should land on grey variants and vice versa.
  const candGrey = /\bgrey\b/.test(b), ourGrey = /grey/.test(ourColour);
  if (ourGrey && candGrey) s += 2;
  if (!ourGrey && candGrey) s -= 2;
  return { s, hard, sim };
}

/** Atomberg (and own stores generally) list FAMILY products ("Renesa + Ceiling
 *  Fan") without sizes — match series + fan-kind instead of tokens. */
function seriesMatch(p, cand) {
  const kind = (n) => (/exhaust/i.test(n) ? "exhaust" : /wall fan/i.test(n) ? "wall" : /pedestal/i.test(n) ? "pedestal" : "ceiling");
  const series = (n) =>
    normalize(n.split("—")[0])
      .replace(new RegExp(`\\b${(p.brand || "").toLowerCase()}\\b`, "g"), "") // drop brand (our names have it, their store doesn't)
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
  // Wires: the size + "sqmm" is the anchor (e.g. "2.5 sqmm"); single core implied.
  if (p.category === "Wires & Cables") {
    const size = (p.name.match(/(\d+(?:\.\d+)?)\s*sq/i) || p.name.match(/(\d+(?:\.\d+)?)/) || [])[1] || "";
    return size ? `${size} sqmm` : "";
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
  const queries = [
    p.brand_sku, // Layer 1: many site searches index the MPN directly
    core && `${brandPrefix}${core}`,
    base && `${brandPrefix}${base}`.slice(0, 55),
  ].filter(Boolean);
  const seen = new Set(), out = [];
  for (const q of queries) {
    for (const c of await SEARCHERS[src](q.trim())) if (!seen.has(c.code)) { seen.add(c.code); out.push(c); }
    await sleep(200);
    if (out.length >= 12) break;
  }
  return out;
}

/* ── Layer 1: exact brand-SKU (MPN) containment ── */
const skuNorm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
function skuHit(p, cand) {
  const key = skuNorm(p.brand_sku);
  if (key.length < 4) return false;
  return skuNorm(cand.code).includes(key) || skuNorm(cand.name).includes(key);
}

/** Best confident candidate for one product on one source, or null.
 *  Returns { c, s, method } — method 'brand-sku' (trusted) or 'name' (pending). */
async function matchOnSource(p, src, base) {
  const brandDirect = BRAND_DIRECT_SRC.has(src);
  const boe = src === "bestofelectricals";
  // OOS/priceless candidates are still mappable (they get flagged, not priced),
  // so no pre-filter here: the live fetch after matching classifies availability.
  const cands = await candidatesFor(p, src, base);

  // Layer 1 — brand SKU: an MPN hit outranks any name score, no type guard needed.
  if (p.brand_sku) {
    const exact = cands.find((c) => skuHit(p, c));
    if (exact) return { c: exact, s: 99, method: "brand-sku" };
  }

  // Layer 1.5 — the fuzzy name matcher (result lands as approval='pending').
  let best = null;
  for (const c of cands) {
    // Multi-brand sources must name the brand; BOE catalogue is already per-brand.
    if (!brandDirect && !boe && !new RegExp(`\\b${(p.brand || "").split(" ")[0]}`, "i").test(c.name)) continue;
    if (brandDirect && p.category === "Fans" && seriesMatch(p, c)) return { c, s: 10, method: "name" };
    const { s, hard, sim } = score(p, c);
    // Accept on a shared hard spec token, OR on a strong fuzzy name match (both
    // gated by the type guard inside score()). The latter catches marketing names.
    const qualifies = hard >= 1 || sim >= 0.5;
    if (qualifies && s > (best?.s ?? 0)) best = { c, s };
  }
  return best && best.s >= 5 ? { ...best, method: "name" } : null;
}

// Fetch the whole catalogue, paging past PostgREST's 1000-row response cap.
async function allProducts() {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,brand_sku,category,spec,unit,parent_id,attrs,elume_price&order=id&limit=1000&offset=${from}`, { headers: { apikey: READ_KEY, Authorization: `Bearer ${READ_KEY}` } });
    const page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  // Rows from a generated-but-unapplied import (same shape). The emitted SQL
  // references their ids, so it must run AFTER the import migration.
  if (process.env.EXTRA_ROWS_FILE) {
    const { readFileSync } = await import("node:fs");
    const extra = JSON.parse(readFileSync(process.env.EXTRA_ROWS_FILE, "utf8"));
    const have = new Set(out.map((p) => p.id));
    let added = 0;
    for (const p of extra) if (!have.has(p.id)) { out.push(p); added++; }
    console.log(`Extra rows appended from ${process.env.EXTRA_ROWS_FILE}: ${added}`);
  }
  if (ONLY_BRAND) return out.filter((p) => (p.brand || "").toLowerCase() === ONLY_BRAND);
  return out;
}

// Existing (product, source) pairs — the mapper only ADDS missing ones, so
// manual and approved mappings are never touched. Needs the service key.
async function existingPairs() {
  if (!SERVICE) return new Set();
  const out = new Set();
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/competitor_map?select=product_id,source&order=product_id&limit=1000&offset=${from}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    const page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    for (const m of page) out.add(`${m.product_id}::${m.source}`);
    if (page.length < 1000) break;
  }
  return out;
}

// A wire colour variant we don't need to map (price is identical across colours);
// map only the Red representative of each brand/grade/size to avoid 6× the work.
function isRedundantWireColour(p) {
  if (p.category !== "Wires & Cables") return false;
  const colour = (p.attrs?.Colour || (p.name.split("—")[1] || "")).toLowerCase();
  return colour ? !colour.includes("red") : false;
}

async function main() {
  const products = await allProducts();
  if (!Array.isArray(products) || products.length === 0) { console.error("Products read failed."); process.exit(1); }
  const existing = await existingPairs();
  const withSku = products.filter((p) => p.brand_sku).length;
  console.log(`Catalogue: ${products.length} products (${withSku} with brand_sku) · ${existing.size} existing mappings will be skipped.`);

  const rows = [];
  let multiSourceProducts = 0, noMatch = 0, considered = 0, bySku = 0, byName = 0;
  for (const p of products) {
    if (isRedundantWireColour(p)) continue; // map one colour per wire family
    const sources = sourcesFor(p).filter((src) => !existing.has(`${p.id}::${src}`));
    if (sources.length === 0) continue;
    considered++;
    if (considered % 25 === 0) console.log(`  … ${considered} products processed, ${rows.length} mappings so far`);
    const base = p.name.split("—")[0].trim(); // drop the colour/variant suffix

    const hits = [];
    for (const src of sources) {
      try {
        const m = await matchOnSource(p, src, base);
        if (!m) continue;
        // Availability check: fetch the live listing so the mapping is written
        // WITH its stock/price state. OOS or price-unavailable listings still
        // map (flagged unavailable; their price never applies) - the mapping
        // survives so the radar starts pricing the moment they restock.
        let live = null;
        if (FETCHERS[src]) { try { live = await FETCHERS[src](m.c.code); } catch { live = null; } }
        const liveEffective = live ? (live.netPrice ?? live.listPrice) : null;
        const buyable = !!live && live.inStock !== false && liveEffective != null && liveEffective > 0;
        if (live && !buyable) console.log(`    ⊘ ${p.id} × ${src}: "${m.c.name.slice(0, 40)}" mapped as ${live.inStock === false ? "OUT OF STOCK" : "no price"}`);

        if (m.method === "brand-sku") bySku++; else byName++;
        hits.push({
          product_id: p.id, source: src, code: m.c.code, unit_factor: unitFactorFor(p, src),
          note: `auto: ${m.c.name.slice(0, 60)} (s${m.s})${live && !buyable ? " · unavailable at map time" : ""}`,
          match_method: m.method,
          approval: m.method === "brand-sku" ? "approved" : "pending", // name matches need a human eye
          live, buyable, // snapshot data for the direct-write below
        });
      } catch { /* a source hiccup shouldn't abort the whole run */ }
    }
    if (hits.length >= 2) multiSourceProducts++;
    if (hits.length === 0) { noMatch++; continue; }
    rows.push(...hits);
    console.log(`  ✓ ${p.brand} ${p.name.slice(0, 40)} → ${hits.map((h) => `${h.source}${h.match_method === "brand-sku" ? "•SKU" : "?"}`).join(", ")}`);
  }

  console.log(`\nMatched ${rows.length} new mappings · ${bySku} by brand-SKU (auto-approved) · ${byName} by name (pending approval) · ${multiSourceProducts} products gained 2+ sellers · ${noMatch}/${considered} unmatched.`);

  if (SERVICE) {
    // Direct write - INSERT only (existing pairs were filtered out above).
    const priceById = new Map(products.map((p) => [p.id, Number(p.elume_price)]));
    const nowIso = new Date().toISOString();
    let written = 0, snapshots = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const chunk = batch.map((m) => ({
        product_id: m.product_id, source: m.source, competitor_code: m.code,
        unit_factor: m.unit_factor, note: m.note, match_method: m.match_method,
        approval: m.approval, item_condition: "New",
      }));
      const r = await fetch(`${SUPABASE_URL}/rest/v1/competitor_map`, {
        method: "POST",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(chunk),
      });
      if (r.ok) written += chunk.length;
      else { console.error(`  ✗ batch ${i}: ${r.status} ${await r.text().catch(() => "")}`); continue; }

      // Availability snapshot from the map-time live fetch, so the admin shows
      // In stock / Out of stock / price immediately (no waiting for a sync).
      // OOS rows: status 'unavailable', NULL comparable - the price never applies.
      const snaps = batch.filter((m) => m.live).map((m) => {
        const effective = m.live.netPrice ?? m.live.listPrice;
        const comparable = m.buyable ? Math.round(effective * (Number(m.unit_factor) || 1) * 100) / 100 : null;
        return {
          product_id: m.product_id, source: m.source,
          competitor_code: m.live.code ?? m.code, competitor_name: m.live.name ?? null, competitor_url: m.live.url ?? null,
          list_price: m.live.listPrice ?? null, net_price: m.live.netPrice ?? null,
          unit_factor: Number(m.unit_factor) || 1,
          comparable_price: comparable,
          suggested_price: comparable != null ? Math.max(1, Math.round(comparable) - 1) : null,
          our_price: priceById.get(m.product_id) ?? null,
          status: m.buyable ? "pending" : "unavailable",
          in_stock: m.live.inStock ?? (m.buyable ? true : false),
          fetched_at: nowIso,
        };
      });
      if (snaps.length) {
        const rs = await fetch(`${SUPABASE_URL}/rest/v1/competitor_prices?on_conflict=product_id,source`, {
          method: "POST",
          headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(snaps),
        });
        if (rs.ok) snapshots += snaps.length;
        else console.error(`  ✗ price snapshots batch ${i}: ${rs.status} ${await rs.text().catch(() => "")}`);
      }
    }
    console.log(`Done - ${written} mappings written (${snapshots} with instant availability snapshots). Pending ones await approval in /admin/products.`);
  } else {
    const sql = [
      "-- ═══════════════════════════════════════════════════════════════",
      "-- Auto-generated mappings (scripts/auto-map-brands.mjs v2, layered).",
      "-- brand-sku matches → approval='approved'; name matches → 'pending'",
      "-- (approve/reject them in /admin/products → Competitor pricing).",
      `-- ${rows.length} new mappings · ${bySku} brand-sku · ${byName} name · ${noMatch}/${considered} unmatched.`,
      "-- ═══════════════════════════════════════════════════════════════",
      "",
      ...rows.map((m) =>
        `insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note, match_method, approval, item_condition) values (${[m.product_id, m.source, m.code].map((x) => `'${String(x).replace(/'/g, "''")}'`).join(", ")}, ${m.unit_factor}, '${m.note.replace(/'/g, "''")}', '${m.match_method}', '${m.approval}', 'New')\n  on conflict (product_id, source) do nothing;`
      ),
      "",
      `select approval, match_method, count(*) from public.competitor_map group by 1, 2 order by 1, 2;`,
      "",
    ].join("\n");
    const outFile = process.env.OUT_SQL || "supabase/migrations/0030_competitor-map-v2.sql";
    fs.writeFileSync(outFile, sql);
    console.log(`SQL written → ${outFile} (review, then run in Supabase).`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
