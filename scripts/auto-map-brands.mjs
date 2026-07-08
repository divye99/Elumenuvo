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

async function boeSearch(q) {
  try {
    const r = await fetch(`https://www.bestofelectricals.com/search?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return [];
    const html = await r.text();
    const out = [];
    for (const b of html.split(/<div class=["']?product-item["']? data-productid=/).slice(1)) {
      const t = b.slice(0, 3000).match(/<h2 class=["']?product-title["']?>\s*<a href=["']?([^ >"']+)["']?[^>]*>([^<]+)<\/a>/);
      const pr = b.slice(0, 3000).match(/price actual-price["']?>([^<]+)</);
      if (t) out.push({ code: t[1].replace(/^\//, ""), name: t[2].trim(), price: pr ? Number(pr[1].replace(/Rs\.?|₹|,|\s/gi, "")) || null : null });
    }
    return out.slice(0, 12);
  } catch { return []; }
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

/* ── which source(s) to try per brand ── */
const SEARCHERS = {
  havells: magentoSearch("https://havells.com"),
  atomberg: magentoSearch("https://atomberg.com"),
  crompton: shopifySearch("https://www.crompton.co.in"),
  syska: syskaSearch,
  bestofelectricals: boeSearch,
};
const BRAND_SOURCES = {
  havells: ["havells"],
  crompton: ["crompton"],
  atomberg: ["atomberg"],
  syska: ["syska", "bestofelectricals"],
  norisys: ["bestofelectricals"],
  anchor: ["bestofelectricals"],
  legrand: ["bestofelectricals"],
  polycab: ["bestofelectricals"],
  finolex: ["bestofelectricals"],
  kei: ["bestofelectricals"],
  "rr kabel": ["bestofelectricals"],
  abb: ["bestofelectricals"],
  philips: ["bestofelectricals"],
  wipro: ["bestofelectricals"],
  usha: ["bestofelectricals"],
  schneider: ["bestofelectricals"],
};

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

async function main() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,category,spec,unit&order=sort_order&limit=500`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  const products = await r.json();
  if (!Array.isArray(products)) { console.error("Products read failed:", products); process.exit(1); }

  const rows = [], unmatched = [];
  for (const p of products) {
    const sources = BRAND_SOURCES[(p.brand || "").toLowerCase()];
    if (!sources) continue;
    const base = p.name.split("—")[0].trim(); // drop the colour/variant suffix
    let best = null;
    for (const src of sources) {
      const brandDirect = ["havells", "crompton", "atomberg", "syska"].includes(src);
      // Attempt 1: brand + base name. Attempt 2 (if empty): brand + hard tokens only.
      let cands = await SEARCHERS[src](`${brandDirect ? "" : p.brand + " "}${base}`.slice(0, 60).trim());
      await sleep(250);
      if (cands.length === 0) {
        const nums = [...hardTokens(normalize(base))].join(" ");
        if (nums) { cands = await SEARCHERS[src](`${brandDirect ? "" : p.brand + " "}${nums}`.trim()); await sleep(250); }
      }
      for (const c of cands) {
        // Brand must appear (whole word) for multi-brand marketplace sources.
        if (!brandDirect && !new RegExp(`\\b${(p.brand || "").split(" ")[0]}`, "i").test(c.name)) continue;
        // Own-store family listings: series + kind match is decisive.
        if (brandDirect && p.category === "Fans" && seriesMatch(p, c)) { best = { src, c, s: 10, hard: 1 }; continue; }
        const { s, hard } = score(p, c);
        if (hard >= 1 && s > (best?.s ?? 0)) best = { src, c, s, hard };
      }
    }
    if (best && best.s >= 5) {
      rows.push({ product_id: p.id, source: best.src, code: best.c.code, note: `auto: ${best.c.name.slice(0, 70)} (score ${best.s})` });
      console.log(`  ✓ ${p.brand} ${p.name.slice(0, 40)} → [${best.src}] ${best.c.name.slice(0, 50)} (s=${best.s})`);
    } else {
      unmatched.push(p);
      console.log(`  ✗ ${p.brand} ${p.name.slice(0, 50)} — no confident match${best ? ` (best s=${best.s})` : ""}`);
    }
  }

  const sql = [
    "-- ═══════════════════════════════════════════════════════════════",
    "-- Auto-generated brand-source competitor mappings (scripts/auto-map-brands.mjs).",
    "-- Complements 0013 (Vashi). Review, then run. Idempotent (upsert).",
    `-- ${rows.length} mapped, ${unmatched.length} unmatched of ${products.length} products.`,
    "-- ═══════════════════════════════════════════════════════════════",
    "",
    ...rows.map((m) =>
      `insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values (${[m.product_id, m.source, m.code].map((x) => `'${String(x).replace(/'/g, "''")}'`).join(", ")}, 1, '${m.note.replace(/'/g, "''")}')\n  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();`
    ),
    "",
    `select source, count(*) from public.competitor_map group by source order by source;`,
    "",
  ].join("\n");
  fs.writeFileSync("supabase/migrations/0020_competitor-map-brands.sql", sql);
  console.log(`\nDone. ${rows.length} mapped, ${unmatched.length} unmatched → supabase/migrations/0020_competitor-map-brands.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
