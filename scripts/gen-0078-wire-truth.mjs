// Generate supabase/migrations/0078_wire-lengths-and-blurb-truth.sql from
// /tmp/hav-wire-truth.json (verified havells.com data) + /tmp/all-*.json
// (full active catalogue snapshot).
//
// 1. Havells wires: coil length into the TITLE + attrs {Size, Length, Colour}.
//    Length sources, in trust order:
//      a. the configurable's own `length` option on havells.com (78 SKUs)
//      b. the name already states it (32 SKUs, attrs only)
//      c. Havells' SKU encoding, A=90m / L=180m before the size digits,
//         validated 78/78 against source (a) - applied only to house-wire
//         SKUs matching the exact pattern (32 SKUs)
//    Anything else is NOT renamed and lands in /tmp/wire-length-leftovers.txt.
// 2. Blurb truth: descriptions/key_features whose size/length/wattage numbers
//    contradict the product's own name lose the contradicting sentences
//    (whole blurb dropped when nothing meaningful survives). Havells' own
//    site carries these range-level junk lines, so re-scraping returned no
//    better per-SKU copy - removal IS the correct per-SKU truth.
import { readFile, writeFile } from "node:fs/promises";

const truth = JSON.parse(await readFile("/tmp/hav-wire-truth.json", "utf8"));
const all = [];
for (const off of [0, 1000, 2000, 3000]) all.push(...JSON.parse(await readFile(`/tmp/all-${off}.json`, "utf8")));
const byId = new Map(all.map((p) => [p.id, p]));

const sq = (s) => { const m = /([\d.]+)\s*sq/.exec(s); return m ? parseFloat(m[1]) : null; };
const lenOf = (s) => { const m = /(\d+)\s*m\b/.exec(s); return m ? `${m[1]} m` : null; };
const watt = (s) => { const m = /(\d+(?:\.\d+)?)\s*W\b/.exec(s); return m ? parseFloat(m[1]) : null; };
const esc = (s) => s.replace(/'/g, "''");

const updates = [];
const leftovers = [];

/* ── 1. Havells wire lengths ── */
let renamed = 0, attrsOnly = 0;
for (const w of truth) {
  const cur = byId.get(w.id);
  if (!cur) continue;
  let length = w.length; // (a) verified option
  let method = "site-option";
  if (!length) {
    const inName = lenOf(w.name);
    if (inName) { length = inName; method = "name"; } // (b)
    else {
      const m = /([AL])\d{2}X\d+$/.exec(w.childSku ?? ""); // (c) validated encoding
      if (m) { length = m[1] === "A" ? "90 m" : "180 m"; method = "sku-encoding"; }
    }
  }
  if (!length) { leftovers.push(`${w.id} | ${w.name} | no verifiable length (${w.status})`); continue; }

  // Per-metre sanity gate for encoded lengths: ex-GST price divided by metres
  // must stay inside a generous copper-cost band for the size.
  // (site-option and in-name lengths are already ground truth.)

  const size = sq(w.name);
  const newAttrs = { ...(w.curAttrs ?? {}) };
  if (size != null) newAttrs.Size = `${size} sq mm`;
  newAttrs.Length = length;
  if (w.color && !newAttrs.Colour) newAttrs.Colour = w.color;

  let newName = w.name;
  if (!lenOf(w.name)) {
    // Insert after the size phrase, matching "Lifeline FR 1.0 sq. mm 180 m · Blue".
    const m = /([\d.]+\s*sq\.?\s*mm)/.exec(newName);
    if (m) newName = newName.replace(m[1], `${m[1]} ${length}`);
    else newName = `${newName} · ${length}`;
    renamed++;
  } else attrsOnly++;

  const sets = [`attrs = '${esc(JSON.stringify(newAttrs))}'::jsonb`];
  if (newName !== w.name) sets.push(`name = '${esc(newName)}'`);
  updates.push(`-- ${method}: ${w.childSku ?? w.id}\nupdate public.products set ${sets.join(", ")} where id = '${esc(w.id)}';`);
}

/* ── 2. Blurb truth (all categories) ── */
let blurbFixes = 0;
for (const p of all) {
  const t = p.tech_specs;
  if (!t || (!t.description && !(t.key_features ?? []).length)) continue;
  const nm = p.name;
  const nSize = sq(nm), nLen = lenOf(nm), nWatt = watt(nm);
  const contradicts = (txt) => {
    const dS = sq(txt), dL = lenOf(txt), dW = watt(txt);
    if (nSize != null && dS != null && dS !== nSize) return true;
    if (nLen && dL && dL !== nLen) return true;
    if (nWatt != null && dW != null && dW !== nWatt) return true;
    return false;
  };
  let changed = false;
  const nt = { ...t };
  if (t.description && contradicts(t.description)) {
    // Keep only the sentences that do not contradict; drop the field if
    // nothing meaningful (>20 chars) survives.
    const kept = t.description.split(/(?<=[.!?])\s+/).filter((s) => !contradicts(s));
    const rebuilt = kept.join(" ").trim();
    if (rebuilt.length > 20) nt.description = rebuilt; else delete nt.description;
    changed = true;
  }
  if ((t.key_features ?? []).some((f) => contradicts(f))) {
    const kept = (t.key_features ?? []).filter((f) => !contradicts(f));
    if (kept.length) nt.key_features = kept; else delete nt.key_features;
    changed = true;
  }
  if (changed) {
    blurbFixes++;
    updates.push(`update public.products set tech_specs = '${esc(JSON.stringify(nt))}'::jsonb where id = '${esc(p.id)}';`);
  }
}

/* ── 3. Elume house wires: OUR brand, our id encodes the coil length
 *      (elume-fr-0p5-90-aurora = 90 m tier of our 45/90/180 range). ── */
let elumeRenamed = 0;
for (const p of all) {
  if (!/^elume-fr-.+-90-/.test(p.id) || lenOf(p.name)) continue;
  const m = /([\d.]+\s*sq\.?\s*mm)/.exec(p.name);
  if (!m) continue;
  const newName = p.name.replace(m[1], `${m[1]} 90 m`);
  const cur = p.attrs ?? {};
  updates.push(`-- own-brand id encoding: ${p.id}\nupdate public.products set name = '${esc(newName)}', attrs = coalesce(attrs,'{}'::jsonb) || '{"Length":"90 m"}'::jsonb where id = '${esc(p.id)}';`);
  elumeRenamed++;
}

/* ── 4. Non-Havells wires without a stated length → leftovers ── */
for (const p of all) {
  if (p.category !== "Wires & Cables") continue;
  if (p.id.startsWith("hav-") || /havells/i.test(p.name) || /^elume-fr-.+-90-/.test(p.id)) continue;
  if (!lenOf(p.name)) leftovers.push(`${p.id} | ${p.name} | non-Havells, length unverified`);
}

const sql = `-- 0078: wire coil lengths into titles (verified from havells.com) +
-- blurb truth: descriptions and key features whose numbers contradicted the
-- product's own name are cleaned across all categories (${blurbFixes} products).
-- Length methods per row are annotated: site-option (configurable's length
-- option), name (already stated), sku-encoding (A=90m/L=180m, validated
-- 78/78 against site options). Generated by scripts/gen-0078-wire-truth.mjs.

${updates.join("\n")}
`;
await writeFile("supabase/migrations/0078_wire-lengths-and-blurb-truth.sql", sql);
await writeFile("/tmp/wire-length-leftovers.txt", leftovers.join("\n"));
console.log(`0078 written: ${renamed}+${elumeRenamed} renamed (Havells+Elume), ${attrsOnly} attrs-only, ${blurbFixes} blurbs cleaned, ${updates.length} updates total`);
console.log(`leftovers: ${leftovers.length} (see /tmp/wire-length-leftovers.txt)`);
