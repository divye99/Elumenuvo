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
 *   4. store-search — remaining Havells/Atomberg/Crompton products: search the
 *                   brand store (Magento/Shopify) and take a confident match's
 *                   SKU. Conservative: exact-ish name hits only.
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

/* ── strategy 4 helpers: brand-store search ── */
function magentoSearch(base) {
  return async (q) => {
    try {
      const query = `query{products(search:${JSON.stringify(q)},pageSize:8){items{sku name}}}`;
      const r = await fetch(`${base}/graphql?query=${encodeURIComponent(query)}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
      if (!r.ok) return [];
      return ((await r.json())?.data?.products?.items ?? []).map((it) => ({ sku: String(it.sku), name: String(it.name ?? "") }));
    } catch { return []; }
  };
}
async function shopifyVariantSku(base, handle) {
  try {
    const r = await fetch(`${base}/products/${handle}.js`, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return null;
    const p = await r.json();
    return p?.variants?.[0]?.sku || null;
  } catch { return null; }
}
const STORE_SEARCH = {
  Havells: magentoSearch("https://havells.com"),
  Atomberg: magentoSearch("https://atomberg.com"),
};

const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Loose-but-safe name check for store-search hits: the distinctive series word
// plus the size (if any) must both appear.
function confidentNameHit(ourName, theirName) {
  const words = ourName.replace(/—.*/, "").toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !["fan", "fans", "wire", "with"].includes(w));
  const series = words.find((w) => !/^\d/.test(w));
  const size = (ourName.match(/(\d{3,4})\s*mm/i) || [])[1];
  const t = theirName.toLowerCase();
  return !!series && t.includes(series) && (!size || t.includes(size));
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

    // 2. own-store — mapping to the brand's own e-store carries the brand SKU.
    const ownSrc = OWN_STORE_SRC[p.brand];
    const own = ownSrc && pm.find((m) => m.source === ownSrc);
    if (own?.competitor_code) { fills.push({ id: p.id, brand_sku: own.competitor_code, via: "own-store" }); continue; }

    // 3. dealer-mpn — Vashi's "I-<manufacturer ref>" codes.
    if (DEALER_MPN_BRANDS.has(p.brand)) {
      const vashi = pm.find((m) => m.source === "vashi" && /^I-[A-Z0-9]{8,}$/i.test(m.competitor_code));
      if (vashi) { fills.push({ id: p.id, brand_sku: vashi.competitor_code.replace(/^I-/i, ""), via: "dealer-mpn" }); continue; }
    }

    // 4. store-search — query the brand store for a confident hit.
    const searcher = STORE_SEARCH[p.brand];
    if (searcher) {
      const q = p.name.replace(/—.*/, "").trim();
      const hits = await searcher(q);
      const hit = hits.find((h) => confidentNameHit(p.name, h.name) && h.sku && norm(h.sku) !== norm(p.sku));
      if (hit) { fills.push({ id: p.id, brand_sku: hit.sku, via: "store-search" }); await sleep(250); continue; }
      await sleep(250);
    }
    // Crompton (Shopify): resolve handle → variant SKU when a crompton mapping exists.
    if (p.brand === "Crompton") {
      const cr = pm.find((m) => m.source === "crompton");
      if (cr?.competitor_code) {
        const sku = await shopifyVariantSku("https://www.crompton.co.in", cr.competitor_code);
        if (sku) { fills.push({ id: p.id, brand_sku: sku, via: "own-store" }); continue; }
      }
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
