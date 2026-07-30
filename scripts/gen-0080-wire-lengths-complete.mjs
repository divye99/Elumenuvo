// 0080: coil length into the NAME of every remaining wire & cable SKU.
//
// Sources, in trust order:
//  A. Havells Consumer Cables List Price w.e.f. 14 May 2026 (havells.com PDF):
//     telecom switch board 90 m carton (A-codes) / 180 m project (L-codes),
//     CAT6 305 m, CATV RG06 90 m, speaker 100 m, 3-core flat 100 m; list
//     prices applied as MRP where the code matches exactly.
//  B. The validated Havells SKU encoding (A=90 m / L=180 m before size
//     digits), 78/78 against havells.com configurable options (0078).
//  C. attrs.Length already on the row from its ORIGINAL import (declared at
//     import time and corroborated by brand retail listings: KEI/APAR/
//     Polycab/Maxima+/CMI/Finolex/Anchor/RR Kabel house coils are 90 m).
// Nothing is guessed: every row handled here has one of these sources.
import { readFile, writeFile } from "node:fs/promises";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const r = await fetch(`${SUPA}/rest/v1/products?select=id,name,brand,spec,attrs,mrp,brand_sku&category=eq.${encodeURIComponent("Wires & Cables")}&is_active=eq.true&limit=1000`, { headers: { apikey: KEY } });
const all = await r.json();

const esc = (s) => s.replace(/'/g, "''");
const hasLen = (s) => /\d+\s*m\b/.test(s);
const updates = [];

/* ── A. Havells specialty: per-SKU facts from the 14 May 2026 list ── */
const SPECIAL = {
  // Telecom switch board: pair count, 90 m (A) / 180 m project (L), LP as MRP
  "hav-whttatea1p40": { name: "Havells Telecom Switch Board Cable 1 Pair · 90 m", attrs: { Pairs: "1 Pair", Length: "90 m" }, mrp: 1030 },
  "hav-whttatea2p40": { name: "Havells Telecom Switch Board Cable 2 Pair · 90 m", attrs: { Pairs: "2 Pair", Length: "90 m" }, mrp: 1715 },
  "hav-whttatea3p40": { name: "Havells Telecom Switch Board Cable 3 Pair · 90 m", attrs: { Pairs: "3 Pair", Length: "90 m" }, mrp: 2525 },
  "hav-whttatea4p40": { name: "Havells Telecom Switch Board Cable 4 Pair · 90 m", attrs: { Pairs: "4 Pair", Length: "90 m" }, mrp: 3275 },
  "hav-whttatea1040": { name: "Havells Telecom Switch Board Cable 10 Pair · 90 m", attrs: { Pairs: "10 Pair", Length: "90 m" }, mrp: 7790 },
  "hav-whttatel2p40": { name: "Havells Telecom Switch Board Cable 2 Pair · 180 m", attrs: { Pairs: "2 Pair", Length: "180 m" } },
  "hav-whttatel4p40": { name: "Havells Telecom Switch Board Cable 4 Pair · 180 m", attrs: { Pairs: "4 Pair", Length: "180 m" } },
  "hav-wrttatea2p40": { name: "Havells Telephone Cable 2 Pair · 90 m", attrs: { Pairs: "2 Pair", Length: "90 m" } },
  // LAN + co-ax
  "hav-whljttercat6": { name: "Havells CAT 6 LAN Cable 23 AWG · 305 m · Grey", attrs: { Length: "305 m", Colour: "Grey" }, mrp: 17070 },
  "hav-whojttkarg06": { name: "Havells CATV RG 06 Co-axial Cable Copper · 90 m", attrs: { Length: "90 m" }, mrp: 3425 },
  "hav-wrojttkarg06": { name: "Havells RG 06 Co-axial Cable · 90 m", attrs: { Length: "90 m" } },
  // Speaker cables: 100 m coils, LP as MRP
  "hav-whpfdawb2x50": { name: "Havells Transparent Twin Flat Speaker Cable 2 x 0.5 sq. mm · 100 m", attrs: { Size: "2 x 0.5 sq mm", Length: "100 m" }, mrp: 3075 },
  "hav-whpfdbwb2x75": { name: "Havells Transparent Twin Flat Speaker Cable 2 x 0.75 sq. mm · 100 m", attrs: { Size: "2 x 0.75 sq mm", Length: "100 m" }, mrp: 4575 },
  "hav-whpfdnwb21x0": { name: "Havells Transparent Twin Flat Speaker Cable 2 x 1.0 sq. mm · 100 m", attrs: { Size: "2 x 1 sq mm", Length: "100 m" }, mrp: 5775 },
  "hav-whpfdnwb21x5": { name: "Havells Transparent Twin Flat Speaker Cable 2 x 1.5 sq. mm · 100 m", attrs: { Size: "2 x 1.5 sq mm", Length: "100 m" }, mrp: 8315 },
  // 3-core flat submersible: 100 m std packing; LP is per 1000 m -> /10 per pack
  "hav-wrpndskg31x5": { name: "Havells 3 Core Flat Cable 1.5 sq. mm · 100 m", attrs: { Size: "1.5 sq mm", Length: "100 m" }, mrp: 16600 },
  "hav-wrpndskg32x5": { name: "Havells 3 Core Flat Cable 2.5 sq. mm · 100 m", attrs: { Size: "2.5 sq mm", Length: "100 m" }, mrp: 26750 },
  "hav-wrpndskg34x0": { name: "Havells 3 Core Flat Cable 4.0 sq. mm · 100 m", attrs: { Size: "4 sq mm", Length: "100 m" }, mrp: 40410 },
};

/* ── B. remaining Havells rows: validated A/L encoding ── */
const encLen = (sku) => {
  const m = /([AL])(?:\d{2}X\d+|1\d{3}|\dX\d{2})$/.exec(sku ?? "");
  return m ? (m[1] === "A" ? "90 m" : "180 m") : null;
};

let special = 0, encoded = 0, attrCopied = 0, untouched = [];
for (const p of all) {
  if (hasLen(p.name)) continue;

  const s = SPECIAL[p.id];
  if (s) {
    const attrs = { ...(p.attrs ?? {}), ...s.attrs };
    const sets = [`name = '${esc(s.name)}'`, `attrs = '${esc(JSON.stringify(attrs))}'::jsonb`];
    if (s.mrp) sets.push(`mrp = ${s.mrp}`);
    updates.push(`-- havells LP 14-May-2026: ${p.brand_sku ?? p.id}\nupdate public.products set ${sets.join(", ")} where id = '${p.id}';`);
    special++;
    continue;
  }

  // Length: attrs first (original-import declaration), else Havells encoding.
  let length = (p.attrs ?? {})?.Length ?? null;
  let method = "import-attr";
  if (!length && p.brand === "Havells") {
    length = encLen(p.brand_sku);
    method = "sku-encoding";
  }
  if (!length) { untouched.push(`${p.id} | ${p.name}`); continue; }
  if (method === "import-attr") attrCopied++; else encoded++;

  // Insert into the name: after the size phrase, else before a trailing
  // colour segment, else append.
  let name = p.name;
  const sizeM = /([\d.]+\s*sq\.?\s*mm)/.exec(name);
  if (sizeM) name = name.replace(sizeM[1], `${sizeM[1]} ${length}`);
  else if (/ · [^·]+$/.test(name)) name = name.replace(/ · ([^·]+)$/, ` ${length} · $1`);
  else name = `${name} · ${length}`;

  const attrs = { ...(p.attrs ?? {}) };
  attrs.Length = length;
  if (sizeM && !attrs.Size) attrs.Size = `${parseFloat(sizeM[1])} sq mm`;

  updates.push(`-- ${method}: ${p.id}\nupdate public.products set name = '${esc(name)}', attrs = '${esc(JSON.stringify(attrs))}'::jsonb where id = '${p.id}';`);
}

const sql = `-- 0080: coil length in the NAME of every wire & cable SKU.
-- Sources: Havells Consumer Cables List Price w.e.f. 14-May-2026 (havells.com,
-- ${special} specialty rows incl. official list prices as MRP), the validated
-- Havells A/L SKU encoding (${encoded} rows), and the Length attribute declared
-- by each product's original import, corroborated by brand retail listings
-- (${attrCopied} rows). Run AFTER 0078/0079.
-- Generated by scripts/gen-0080-wire-lengths-complete.mjs.

${updates.join("\n")}
`;
await writeFile("supabase/migrations/0080_wire-lengths-complete.sql", sql);
console.log(`0080: ${special} specialty (LP) + ${encoded} encoded + ${attrCopied} attr-copied = ${updates.length} updates`);
if (untouched.length) { console.log("STILL UNRESOLVED:"); untouched.forEach((u) => console.log("  " + u)); }
else console.log("every active wire & cable SKU now has a length");
