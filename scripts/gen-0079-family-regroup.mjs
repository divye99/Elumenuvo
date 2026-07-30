// Audit + regroup variant families across ALL categories.
//
// The import created one family per size (colour-only siblings), so the PDP
// picker cannot switch sizes or lengths. This script finds product RANGES
// whose members are split across several families, verifies every member is
// uniquely distinguishable by variant dimensions (Size / Length / Colour /
// Sweep / Wattage), and emits supabase/migrations/0079_variant-family-regroup.sql
// that re-points parent_id so each range is ONE family. Ranges with
// indistinguishable members are skipped and reported, never guessed.
//
// Runs on POST-0078 names: the 0078 SQL is replayed in-memory first.
import { readFile, writeFile } from "node:fs/promises";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ── load the live catalogue ──
const all = [];
{
  let from = 0;
  for (;;) {
    const r = await fetch(
      `${SUPA}/rest/v1/products?select=id,name,brand,category,parent_id,attrs&is_active=eq.true&order=id&limit=1000&offset=${from}`,
      { headers: { apikey: KEY } }
    );
    const page = await r.json();
    all.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
}
console.log(`${all.length} active products`);

// ── replay 0078 renames/attrs in-memory ──
const sql78 = await readFile("supabase/migrations/0078_wire-lengths-and-blurb-truth.sql", "utf8");
const byId = new Map(all.map((p) => [p.id, p]));
for (const m of sql78.matchAll(/update public\.products set ([^;]+) where id = '([^']+)';/g)) {
  const p = byId.get(m[2]);
  if (!p) continue;
  const nameM = /name = '((?:[^']|'')*)'/.exec(m[1]);
  if (nameM) p.name = nameM[1].replace(/''/g, "'");
  const attrsM = /attrs = '((?:[^']|'')*)'::jsonb/.exec(m[1]);
  if (attrsM) {
    try { p.attrs = { ...(p.attrs ?? {}), ...JSON.parse(attrsM[1].replace(/''/g, "'")) }; } catch { /* merge-style attrs skipped */ }
  }
}

// ── variant-token extraction ──
const COLOURS = ["Black","Blue","Green","Red","White","Yellow","Grey","Brown","Pearl White","Marble White","Midnight Black","Matte Black","Earth Brown","Matte Brown","Ivory & Black","Metallic Gold","Dark Teakwood","Sand Grey","Ultraviolet","Solar Flare","Aurora","Ember","Midnight","Moonlight","Eclipse","Frost White","Quartz Grey","Charcoal Black","Scarlet Red","Ivory","Silver","Gold","Steel","Copper","Champagne","Wood","Teak","Walnut","Bianco","Sapphire","Ruby","Pristine White"];
function dimsOf(p) {
  const n = p.name;
  const a = p.attrs ?? {};
  const size = a.Size ?? (/([\d.]+)\s*sq\.?\s*mm/.exec(n)?.[1] && `${parseFloat(/([\d.]+)\s*sq\.?\s*mm/.exec(n)[1])} sq mm`);
  const length = a.Length ?? (/(\d+)\s*m\b/.exec(n)?.[1] && `${/(\d+)\s*m\b/.exec(n)[1]} m`);
  const sweep = a.Sweep ?? (/(\d{3,4})\s*mm\b/.exec(n)?.[1] && `${/(\d{3,4})\s*mm\b/.exec(n)[1]} mm`);
  const wattage = a.Wattage ?? (/([\d.]+)\s*W\b/.exec(n)?.[1] && `${parseFloat(/([\d.]+)\s*W\b/.exec(n)[1])} W`);
  // Colour: attr first, then the " · X" tail, then a known colour word.
  let colour = a.Colour ?? null;
  if (!colour) {
    const tail = /·\s*([^·]+)$/.exec(n)?.[1]?.trim();
    if (tail && COLOURS.some((c) => c.toLowerCase() === tail.toLowerCase())) colour = tail;
  }
  if (!colour) for (const c of COLOURS) if (new RegExp(`\\b${c}\\b`, "i").test(n)) { colour = c; break; }
  return { Size: size || null, Length: length || null, Sweep: sweep || null, Wattage: wattage || null, Colour: colour };
}

// Base name = the range: name minus every variant token.
function baseOf(p) {
  let b = ` ${p.name} `;
  b = b.replace(/[\d.]+\s*sq\.?\s*mm/gi, " ");
  b = b.replace(/\b\d+\s*m\b/gi, " ");
  b = b.replace(/\b\d{3,4}\s*mm\b/gi, " ");
  b = b.replace(/\b[\d.]+\s*W\b/g, " ");
  for (const c of COLOURS) b = b.replace(new RegExp(`\\b${c}\\b`, "gi"), " ");
  return b.replace(/·/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

// ── group into ranges, find split families ──
const ranges = new Map();
for (const p of all) {
  const key = `${p.brand}|${p.category}|${baseOf(p)}`;
  if (!ranges.has(key)) ranges.set(key, []);
  ranges.get(key).push(p);
}

const updates = [];
const report = [];
const skipped = [];
let merged = 0;
for (const [key, members] of ranges) {
  if (members.length < 2) continue;
  const fams = new Set(members.map((p) => p.parent_id ?? p.id));
  if (fams.size < 2) continue; // already one family

  // Every member must be uniquely distinguishable by its dim tuple.
  const seen = new Map();
  let clash = null;
  const dimmed = members.map((p) => ({ p, d: dimsOf(p) }));
  for (const { p, d } of dimmed) {
    const tup = JSON.stringify([d.Size, d.Length, d.Sweep, d.Wattage, d.Colour]);
    if (seen.has(tup)) { clash = `${seen.get(tup)} vs ${p.id}`; break; }
    seen.set(tup, p.id);
  }
  if (clash) { skipped.push(`${key} :: indistinguishable members (${clash})`); continue; }

  // At least one dimension must actually vary; a range that only repeats
  // the same product is not a variant family.
  const varying = ["Size", "Length", "Sweep", "Wattage", "Colour"].filter(
    (k) => new Set(dimmed.map(({ d }) => d[k])).size > 1
  );
  if (!varying.length) { skipped.push(`${key} :: no varying dimension`); continue; }

  // Elect the parent: the current parent that already has the most members.
  const famCount = new Map();
  for (const p of members) {
    const f = p.parent_id ?? p.id;
    famCount.set(f, (famCount.get(f) ?? 0) + 1);
  }
  const parentId = [...famCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  if (!byId.has(parentId)) { skipped.push(`${key} :: elected parent ${parentId} not in active set`); continue; }

  merged++;
  report.push(`MERGE ${members.length} products, dims [${varying.join(", ")}] → parent ${parentId} :: ${key}`);
  for (const { p, d } of dimmed) {
    // Write the distinguishing attrs the picker needs (only the varying ones).
    const attrs = { ...(p.attrs ?? {}) };
    for (const k of varying) if (d[k]) attrs[k] = d[k];
    const sets = [`attrs = '${JSON.stringify(attrs).replace(/'/g, "''")}'::jsonb`];
    if (p.id === parentId) sets.push("parent_id = null");
    else sets.push(`parent_id = '${parentId}'`);
    updates.push(`update public.products set ${sets.join(", ")} where id = '${p.id}';`);
  }
}

/* ── final validation: simulate the migration, then check every RESULTING
 *    family for members with identical dim tuples (two ranges can elect the
 *    same parent, silently unioning - fine only if still distinguishable). ── */
const finalParent = new Map(all.map((p) => [p.id, p.parent_id ?? null]));
for (const u of updates) {
  const id = /where id = '([^']+)'/.exec(u)[1];
  const pm = /parent_id = '([^']+)'/.exec(u);
  finalParent.set(id, pm ? pm[1] : /parent_id = null/.test(u) ? null : finalParent.get(id));
}
const famMembers = new Map();
for (const p of all) {
  const f = finalParent.get(p.id) ?? p.id;
  if (!famMembers.has(f)) famMembers.set(f, []);
  famMembers.get(f).push(p);
}
// Only families this migration actually touches - untouched families may use
// dims (module size etc.) that live in their real attrs, not our extractor.
const touched = new Set(updates.map((u) => {
  const id = /where id = '([^']+)'/.exec(u)[1];
  return finalParent.get(id) ?? id;
}));
let clashes = 0;
for (const [f, members] of famMembers) {
  if (!touched.has(f)) continue;
  if (members.length < 2) continue;
  const seen = new Map();
  for (const p of members) {
    const d = dimsOf(p);
    const tup = JSON.stringify([d.Size, d.Length, d.Sweep, d.Wattage, d.Colour]);
    if (seen.has(tup)) { clashes++; skipped.push(`POST-MERGE CLASH in family ${f}: ${seen.get(tup)} vs ${p.id}`); }
    else seen.set(tup, p.id);
  }
}
if (clashes) console.log(`⚠ ${clashes} post-merge dim clashes - see report`);
else console.log("post-merge validation: every resulting family fully distinguishable");

const sql = `-- 0079: variant-family regroup - one family per product RANGE, so the PDP
-- picker switches Size / Length / Colour / Sweep / Wattage, not just colour.
-- ${merged} ranges merged; ranges with indistinguishable members were skipped
-- (see the report in the commit). Generated by scripts/gen-0079-family-regroup.mjs.
-- Run AFTER 0078 (names/attrs there feed the grouping).

${updates.join("\n")}
`;
await writeFile("supabase/migrations/0079_variant-family-regroup.sql", sql);
await writeFile("/tmp/regroup-report.txt", ["== MERGED ==", ...report, "", "== SKIPPED ==", ...skipped].join("\n"));
console.log(`${merged} ranges merged (${updates.length} row updates) · ${skipped.length} skipped · report at /tmp/regroup-report.txt`);
