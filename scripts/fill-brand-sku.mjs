/**
 * Fill products.brand_sku — the manufacturer part number (MPN) that Layer-1
 * price matching joins on across seller sites.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/fill-brand-sku.mjs
 *   DRY_RUN=1 …                                  → report only, no writes
 *
 * Strategies, in confidence order (only ever fills EMPTY brand_sku):
 *   1. embedded   — Norisys: our SKU is "NOR-<catalogue code>" (e.g.
 *                   NOR-C5331.02) → brand_sku = the code. Deterministic.
 *   2. own-store  — products already mapped to their brand's own e-store
 *                   (havells/atomberg/crompton/syska sources): the mapping's
 *                   competitor_code IS the brand's SKU. Copy it.
 *   3. dealer-mpn — Vashi codes are manufacturer refs with an "I-" prefix
 *                   (e.g. I-1SYN869006R0001 for ABB) → strip prefix. Applied
 *                   for switchgear/DB brands sold through dealers.
 *   4. store-search — scrape the brand's OWN e-commerce store (Havells Magento,
 *                   Orient/Crompton Shopify, Syska Dukaan) and take the best
 *                   candidate that (a) scores as the same product by type + hard
 *                   spec tokens (pole/amp/watt/sweep) + name similarity, and
 *                   (b) looks like a real MPN. Family-name "skus" (Atomberg) and
 *                   bot-walled stores (Usha/Wipro) are dropped, not guessed.
 *
 * Wires (Polycab/KEI/APAR/RR/Finolex…) are intentionally skipped — house wire
 * has no meaningful retail MPN; the name matcher owns that category.
 */
if (typeof globalThis.WebSocket === "undefined") {
  try { globalThis.WebSocket = (await import("ws")).default; } catch {}
}
const _fetch = globalThis.fetch;
globalThis.fetch = (u, o = {}) => _fetch(u, { ...o, signal: o.signal ?? AbortSignal.timeout(20000) });

const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const DRY = !!process.env.DRY_RUN;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!URL_ || !KEY) { console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
console.log(`fill-brand-sku · node ${process.version}${DRY ? " · DRY RUN" : ""}`);

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function readAll(table, cols, order) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${cols}&order=${order}&limit=1000&offset=${from}`, { headers: H });
    const page = await r.json();
    if (!Array.isArray(page) || page.length === 0) break;
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

/* ── strategy 4: brand-store search + confident match ──
 * Precision matters more than recall here: a WRONG brand SKU pollutes every
 * downstream cross-site match. So we (a) score candidates by type + hard spec
 * tokens (pole SP/DP/TP, amperage, wattage, sweep) plus trigram similarity —
 * not first-hit — and (b) only accept a code that LOOKS like a real MPN, which
 * cleanly rejects stores that return the family name as the "sku" (Atomberg). */

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// A real manufacturer part number has letters+digits or a coded shape — not a
// plain phrase. "FHCOB5SGMW48E-C" ✓  "DHFNCSPA03200EB" ✓  "Renesa Elite" ✗.
function looksLikeMpn(sku) {
  const s = String(sku || "").trim();
  if (!s || /\s/.test(s)) return false;         // MPNs don't contain spaces
  if (!/\d/.test(s)) return false;              // must have a digit
  if (!/[a-z]/i.test(s) && s.length < 6) return false;
  return /^[A-Za-z0-9][A-Za-z0-9._/-]{3,}$/.test(s);
}

// Normalise the word-form zoo so tokens compare (mirrors the auto-mapper).
function normalize(s) {
  return (s || "").toLowerCase()
    .replace(/\bsingle\b/g, "1").replace(/\bdouble\b/g, "2").replace(/\btriple\b/g, "3")
    .replace(/(\d)\s*[- ]\s*(way|pin|module|pole|gang|core)\b/g, "$1$2")
    .replace(/(\d(?:\.\d+)?)\s*(a|amp|amps)\b/g, "$1a")
    .replace(/(\d+)\s*(w|watt|watts)\b/g, "$1w")
    .replace(/(\d+)\s*mm\b/g, "$1mm");
}
// Distinguishing tokens — at least one must match for a confident mapping.
function hardTokens(s) {
  const t = new Set();
  for (const m of s.matchAll(/\b(\d+(?:\.\d+)?(?:a|w|way|pin|module|pole|gang|core|mm))\b/g)) t.add(m[1]);
  for (const m of s.matchAll(/\b(spn|tpn|dpn|dp|sp|tp|fp)\b/g)) t.add(m[1]); // pole/DB config discriminates strongly
  return t;
}
function trigrams(s) {
  const x = ` ${(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const g = new Set();
  for (let i = 0; i < x.length - 2; i++) g.add(x.slice(i, i + 3));
  return g;
}
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0; for (const t of a) if (b.has(t)) inter++;
  return (2 * inter) / (a.size + b.size);
}
// Type guard: the candidate must be the same KIND of product.
const TYPE = {
  "Switchgear": /\b(mcb|rccb|rcbo|isolator|changeover|disconnector|elcb|breaker)\b/i,
  "DB & Panels": /\b(distribution board|\bdb\b|spn|tpn|enclosure|way)\b/i,
  "Modular": /\b(switch|socket|regulator|dimmer|plate|module|holder|bell)\b/i,
  "Lighting": /\b(led|light|lamp|batten|panel|bulb|downlight|flood|street|luminaire)\b/i,
  "Fans": /\b(fan|bldc|sweep|exhaust)\b/i,
};
const TYPE_NOUN = {
  "Switchgear": /\b(mcb|rccb|rcbo|isolator|changeover|disconnector|elcb)\b/i,
  "DB & Panels": /\b(distribution board|\bdb\b)\b/i,
  "Modular": /\b(switch|socket|regulator|dimmer|module)\b/i,
  "Lighting": /\b(panel|batten|bulb|downlight|flood ?light|street ?light|light|lamp)\b/i,
  "Fans": /\b(fan|exhaust)\b/i,
};

/** A clean, search-friendly query: type noun + primary numeric spec.
 *  ("DP MCB 32A 'C' curve" → "MCB 32"). Magento/Shopify search is AND-over
 *  tokens, so fewer clean terms = far better recall. */
function coreQuery(p) {
  if (p.category === "Fans") {
    const series = p.name.replace(/—.*/, "").split(/\s+/).slice(1)
      .find((w) => w && !/^\d/.test(w) && !["ceiling", "wall", "pedestal", "exhaust", "fan", "fans", "bldc", "smart"].includes(w.toLowerCase()));
    if (series) return series.replace(/\+$/, "");
    const mm = (p.name.match(/(\d{3,4})\s*mm/i) || [])[1];
    return mm ? `${mm} fan` : "fan";
  }
  const re = TYPE_NOUN[p.category];
  const noun = re ? (p.name.match(re) || [])[0] : "";
  const num = (p.name.replace(/—.*/, "").match(/\b(\d+(?:\.\d+)?)\s*(?:a|w|mm|watt|amp)?\b/i) || [])[1] || "";
  return `${noun || ""} ${num}`.trim() || p.name.replace(/—.*/, "").trim();
}

/** Score one candidate for a product; higher = better. -1 = wrong type. */
function scoreCandidate(p, cand) {
  const typeRe = TYPE[p.category];
  if (typeRe && !typeRe.test(cand.name)) return -1;
  const a = normalize(`${p.name.split("—")[0]} ${p.spec ?? ""}`);
  const b = normalize(cand.name);
  const ha = hardTokens(a), hb = hardTokens(b);
  let s = 0, hard = 0;
  for (const t of ha) if (hb.has(t)) { s += 3; hard++; }
  const sim = dice(trigrams(a), trigrams(b));
  s += Math.round(sim * 6);
  // Require a discriminating spec token OR a strong name similarity.
  if (hard < 1 && sim < 0.5) return -1;
  return s;
}

/* ── store adapters: return [{ sku, name }] for a query ── */
function magentoStore(base) {
  return async (q) => {
    try {
      const query = `query{products(search:${JSON.stringify(q)},pageSize:8){items{sku name}}}`;
      const r = await fetch(`${base}/graphql?query=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) return [];
      return ((await r.json())?.data?.products?.items ?? []).map((it) => ({ sku: String(it.sku ?? ""), name: String(it.name ?? "") }));
    } catch { return []; }
  };
}
// Shopify: search suggest → per-handle product.js → variant.sku (fallback EAN barcode).
function shopifyStore(base) {
  return async (q) => {
    try {
      const r = await fetch(`${base}/search/suggest.json?q=${encodeURIComponent(q)}&resources%5Btype%5D=product&resources%5Blimit%5D=5`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) return [];
      const products = (await r.json())?.resources?.results?.products ?? [];
      const out = [];
      for (const pr of products.slice(0, 5)) {
        let sku = "";
        try {
          const jr = await fetch(`${base}/products/${pr.handle}.js`, { headers: { "User-Agent": UA, Accept: "application/json" } });
          if (jr.ok) { const j = await jr.json(); sku = j?.variants?.[0]?.sku || j?.variants?.[0]?.barcode || ""; }
        } catch { /* keep going */ }
        out.push({ sku: String(sku), name: String(pr.title ?? ""), handle: pr.handle });
        await sleep(120);
      }
      return out;
    } catch { return []; }
  };
}
// Dukaan (Syska): the product slug is the closest thing to a code.
async function syskaStore(q) {
  try {
    const r = await fetch("https://syska.co.in/", { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!r.ok) return [];
    const m = (await r.text()).match(/id="__DUKAAN_DATA__">([\s\S]*?)<\/script>/);
    if (!m) return [];
    const prods = [];
    const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === "object") { if (o.slug && o.name) prods.push({ sku: o.sku || o.slug, name: o.name }); Object.values(o).forEach(walk); } };
    walk(JSON.parse(m[1]).DUKAAN_CATALOG ?? {});
    const ql = q.toLowerCase();
    return prods.filter((x) => x.name.toLowerCase().includes(ql)).slice(0, 8);
  } catch { return []; }
}

// Brands whose OWN e-commerce store we can scrape for a real MPN. Verified live:
//   Havells  — Magento, returns genuine part numbers (FHCOB5SGMW48E-C).
//   Orient   — Shopify, variant sku + EAN barcode.
//   Crompton — Shopify.
//   Atomberg — Magento, but "sku" is the family name → looksLikeMpn() drops it.
//   Syska    — Dukaan slug.
// Bot-walled / not scrapable (skipped; documented): Usha (Radware), Wipro (429).
const STORES = {
  Havells: magentoStore("https://havells.com"),
  Atomberg: magentoStore("https://atomberg.com"),
  Orient: shopifyStore("https://orientelectric.com"),
  Crompton: shopifyStore("https://www.crompton.co.in"),
  Syska: syskaStore,
};

/** Search a brand's store and return the best confident MPN, or null. */
async function storeSearchSku(p) {
  const searcher = STORES[p.brand];
  if (!searcher) return null;
  const queries = [coreQuery(p), p.name.replace(/—.*/, "").trim()];
  const seen = new Set(); const cands = [];
  for (const q of queries) {
    if (!q) continue;
    for (const c of await searcher(q)) if (c && !seen.has(c.name + c.sku)) { seen.add(c.name + c.sku); cands.push(c); }
    if (cands.length >= 8) break;
    await sleep(150);
  }
  let best = null;
  for (const c of cands) {
    if (!looksLikeMpn(c.sku) || norm(c.sku) === norm(p.sku)) continue;
    const s = scoreCandidate(p, c);
    if (s >= 3 && s > (best?.s ?? 2)) best = { sku: c.sku, name: c.name, s };
  }
  return best;
}

async function main() {
  const products = await readAll("products", "id,sku,name,brand,category,brand_sku", "id");
  const maps = await readAll("competitor_map", "product_id,source,competitor_code", "product_id");
  console.log(`Catalogue ${products.length} products · ${maps.length} mappings.`);

  const mapBy = new Map(); // product_id → [{source, code}]
  for (const m of maps) { if (!mapBy.has(m.product_id)) mapBy.set(m.product_id, []); mapBy.get(m.product_id).push(m); }

  const OWN_STORE_SRC = { Havells: "havells", Atomberg: "atomberg", Crompton: "crompton", Syska: "syska" };
  const DEALER_MPN_BRANDS = new Set(["ABB", "Schneider", "Legrand", "Havells"]); // Vashi codes = I-<MPN>
  const WIRE_SKIP = new Set(["Polycab", "KEI", "APAR", "RR Kabel", "Finolex", "Anchor", "CMI"]);

  const fills = []; // { id, brand_sku, via }
  let skippedWire = 0, already = 0;

  for (const p of products) {
    if (p.brand_sku) { already++; continue; }
    if (p.category === "Wires & Cables" && WIRE_SKIP.has(p.brand)) { skippedWire++; continue; }

    // 1. embedded — Norisys catalogue code inside our own SKU (NOR-C5331.02).
    if (p.brand === "Norisys") {
      const code = (p.sku || "").replace(/^NOR-/i, "").trim();
      if (/^[A-Z]{1,3}\d{3,5}(\.\d{1,2})?$/i.test(code)) { fills.push({ id: p.id, brand_sku: code, via: "embedded" }); continue; }
    }

    const pm = mapBy.get(p.id) ?? [];

    // 2. own-store — a mapping to the brand's own e-store often already carries
    //    the real part number (Havells Magento sku). Only trust it if it LOOKS
    //    like an MPN; Crompton handles / Atomberg family names fall through to
    //    the store search below, which resolves the true variant sku/EAN.
    const ownSrc = OWN_STORE_SRC[p.brand];
    const own = ownSrc && pm.find((m) => m.source === ownSrc);
    if (own?.competitor_code && looksLikeMpn(own.competitor_code)) { fills.push({ id: p.id, brand_sku: own.competitor_code, via: "own-store" }); continue; }

    // 3. dealer-mpn — Vashi's "I-<manufacturer ref>" codes.
    if (DEALER_MPN_BRANDS.has(p.brand)) {
      const vashi = pm.find((m) => m.source === "vashi" && /^I-[A-Z0-9]{8,}$/i.test(m.competitor_code));
      if (vashi) { fills.push({ id: p.id, brand_sku: vashi.competitor_code.replace(/^I-/i, ""), via: "dealer-mpn" }); continue; }
    }

    // 4. store-search — scrape the brand's OWN e-commerce store and take the
    //    best confident, MPN-shaped code. Precise scorer, not first-hit.
    if (STORES[p.brand]) {
      const hit = await storeSearchSku(p);
      if (hit) { fills.push({ id: p.id, brand_sku: hit.sku, via: "store-search" }); continue; }
    }
  }

  const byVia = {};
  fills.forEach((f) => (byVia[f.via] = (byVia[f.via] ?? 0) + 1));
  console.log(`\nFillable: ${fills.length} (${JSON.stringify(byVia)}) · already set: ${already} · wire skipped: ${skippedWire}`);
  fills.slice(0, 15).forEach((f) => console.log(`  ${f.via.padEnd(12)} ${f.id} → ${f.brand_sku}`));
  if (fills.length > 15) console.log(`  … and ${fills.length - 15} more`);

  if (DRY) { console.log("\nDRY RUN — nothing written."); return; }

  let written = 0;
  for (const f of fills) {
    const r = await fetch(`${URL_}/rest/v1/products?id=eq.${encodeURIComponent(f.id)}&brand_sku=is.null`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ brand_sku: f.brand_sku }),
    });
    if (r.ok) written++;
    else console.error(`  ✗ ${f.id}: ${r.status} ${await r.text().catch(() => "")}`);
  }
  console.log(`\nDone — ${written}/${fills.length} products updated with brand_sku.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
