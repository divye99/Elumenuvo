/**
 * Auto-map our catalogue to Vashi products (best-effort, by brand + gauge +
 * type). Writes a reviewable competitor_map seed SQL. Prices come later via the
 * monthly sync — this only decides WHICH Vashi item each product maps to.
 *
 *   node scripts/auto-map-vashi.mjs  → writes supabase/competitor-map-seed.sql
 *
 * Reads products from the anon Supabase REST API (public read). No auth needed.
 */
import fs from "fs";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
const VASHI = "https://prodapi.vashiisl.com/occ/v2/visl";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadProducts() {
  // Prefer a local snapshot if present (scratchpad), else hit the REST API.
  const snap = process.env.PRODUCTS_JSON;
  if (snap && fs.existsSync(snap)) return JSON.parse(fs.readFileSync(snap, "utf8"));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name,brand,category,unit,attrs&order=sort_order&limit=500`, {
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  return r.json();
}

async function searchVashi(query, size = 10) {
  const url = `${VASHI}/products/search?query=${encodeURIComponent(query)}&fields=FULL&currentPage=0&pageSize=${size}&lang=en&curr=INR`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.products ?? []).map((p) => ({
      code: String(p.code ?? ""),
      name: String(p.name ?? ""),
      brand: String(p.manufacturer ?? ""),
      price: p.price?.value ?? null,
      url: typeof p.url === "string" ? p.url : null,
    }));
  } catch {
    return [];
  }
}

// Score a candidate against our product (higher = better). Brand-only is NOT
// enough — we require a real spec/type signal to avoid cross-category garbage
// (e.g. a Havells wire matching a Havells LED light).
function score(our, cand) {
  const oName = `${our.brand} ${our.name} ${our.attrs?.Size ?? ""} ${our.attrs?.Quality ?? ""}`.toLowerCase();
  const cName = `${cand.brand} ${cand.name}`.toLowerCase();
  const isWire = our.category === "Wires & Cables";
  let s = 0;

  if (cand.brand && our.brand && cand.brand.toLowerCase() === our.brand.toLowerCase()) s += 5;

  // Hard category guards — a mismatched product type is disqualifying.
  const candIsLight = /\b(led|light|lamp|lumen|\d+\s*w\b|batten|panel|bulb|downlight)\b/.test(cName);
  const candIsWire = /(sq\s*mm|sqmm|core|cable|conductor|frls|frlsh)/.test(cName);
  if (isWire && candIsLight) return -100;
  if (isWire && !candIsWire) return -100;
  if (!isWire && candIsWire && /\bcore\b|sq\s*mm/.test(cName)) return -100;

  const size = our.attrs?.Size?.match(/([\d.]+)/)?.[1];
  if (size && new RegExp(`\\b${size}\\s*(sq\\s*mm|sqmm)`).test(cName)) s += 5;
  else if (isWire) s -= 4; // wire without a matching gauge is a weak match

  for (const kw of ["fr", "frls", "flexible", "single core", "1 core", "pvc", "copper"]) {
    if (oName.includes(kw) && cName.includes(kw)) s += 1;
  }
  if (/\b(2|3|4|5|7|12|19)\s*core/.test(cName) && isWire) s -= 3; // multi-core armoured ≠ our house wire
  if (/1\s*core|single core/.test(cName)) s += 2;
  return s;
}

function factorFor(p) {
  const len = p.attrs?.Length?.match(/(\d+)\s*m/);
  if (len) return Number(len[1]); // Vashi prices wire per metre → coil metres
  return 1;
}

function esc(s) { return String(s ?? "").replace(/'/g, "''"); }

async function main() {
  const products = await loadProducts();
  console.log(`Auto-mapping ${products.length} products against Vashi…`);
  const rows = [];
  const unmatched = [];

  for (const p of products) {
    const size = p.attrs?.Size ? ` ${p.attrs.Size}` : "";
    const q = `${p.brand} ${p.name}`.replace(/—.*/, "").replace(/\(.*?\)/g, "").trim() + size;
    const cands = await searchVashi(q, 10);
    let best = null, bestScore = -Infinity;
    for (const c of cands) {
      const sc = score(p, c);
      if (sc > bestScore) { bestScore = sc; best = c; }
    }
    if (best && bestScore >= 8) {
      rows.push({ id: p.id, code: best.code, url: best.url, factor: factorFor(p), score: bestScore, vashiName: best.name });
      console.log(`  ✓ ${p.id} → ${best.code} (score ${bestScore}) ×${factorFor(p)}`);
    } else {
      unmatched.push(p.id);
      console.log(`  · ${p.id} — no confident match (best ${bestScore})`);
    }
    await sleep(200);
  }

  const sql = `-- Auto-generated Vashi mappings (best-effort by brand + gauge + type).
-- Review and fix in /admin/radar. Run in Supabase → SQL Editor.
insert into public.competitor_map (product_id, source, competitor_code, competitor_url, unit_factor, note)
values
${rows.map((r) => `  ('${r.id}', 'vashi', '${esc(r.code)}', ${r.url ? `'https://vashiisl.com${esc(r.url)}'` : "null"}, ${r.factor}, 'auto · score ${r.score}')`).join(",\n")}
on conflict (product_id, source) do update set
  competitor_code = excluded.competitor_code,
  competitor_url = excluded.competitor_url,
  unit_factor = excluded.unit_factor,
  note = excluded.note;

-- Unmatched (${unmatched.length}): ${unmatched.join(", ") || "none"}
`;
  fs.writeFileSync("supabase/competitor-map-seed.sql", sql);
  console.log(`\nDone. ${rows.length} mapped, ${unmatched.length} unmatched → supabase/competitor-map-seed.sql`);
}

main().catch((e) => { console.error(e); process.exit(1); });
