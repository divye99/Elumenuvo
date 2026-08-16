#!/usr/bin/env node
/**
 * L&K variant regrouping - turns the 1,119 standalone Lauritz Knudsen imports
 * (0114) into parent+variation families, mirroring the Havells regrouping.
 *
 * Method: parse each name into ATTRS (Current Rating, Poles, Sensitivity,
 * Modules, Colour, ...) and a RESIDUE (the name with attr tokens and pure
 * marketing phrases removed). Products sharing (category, residue) form a
 * family. Guard rails:
 *   - a family groups only when >=2 members and every member has a UNIQUE
 *     attr tuple (ambiguous pickers are worse than no grouping);
 *   - HARD RULE (owner): max 3 DIFFERENTIATING dims per family - families
 *     needing more stay standalone and are reported;
 *   - unparsed names stay standalone (safe default).
 * Parent = the member with the smallest leading numeric attr (6A before 63A,
 * 2 Module before 8 Module); everyone else points parent_id at it.
 *
 * Input: scripts/data/lk-live.json (live rows). Output: migration 0117 +
 * a stats/sample report on stdout.
 */
import { readFileSync, writeFileSync } from "node:fs";

const all = JSON.parse(readFileSync("scripts/data/lk-live.json", "utf8"));

const MARKETING = [
  /Energy Saving/gi, /Higher Life/gi, /Long Electrical & Mech\w*(\s+Life)?/gi, /Durable Overload R\w*/gi,
  /Directly Operated/gi, /Clean & elegant finish/gi, /Premium Look/gi, /Suitable for [Ii]solation/gi,
  /with Enhanced Safety/gi, /IP40 Protection/gi, /Finger proof IP20 terminals/gi, /ISI Certified/gi,
  // Redundant with the "Adi" token that stays in the residue.
  /with Added Immunity/gi,
];

function parse(rawName, category) {
  let n = rawName.replace(/^Lauritz Knudsen\s*/i, "").trim();
  for (const re of MARKETING) n = n.replace(re, " ");
  const attrs = {};
  const take = (re, key, fmt = (m) => m[1]) => {
    const m = n.match(re);
    if (m && attrs[key] === undefined) { attrs[key] = fmt(m); n = n.replace(m[0], " "); return true; }
    return false;
  };

  // Order matters: ranges and mA before the bare-ampere rating.
  take(/Relay Range:?\s*([\d.]+\s*-\s*[\d.]+)\s*A/i, "Relay Range", (m) => `${m[1].replace(/\s+/g, "")}A`);
  take(/(\d+)\s*mA\b/, "Sensitivity", (m) => `${m[1]}mA`);
  // Rating: an ampere figure NOT part of kA / a range / "Upto".
  take(/(?<![\d.\-–])(?<!Upto\s)(\d+(?:\.\d+)?)\s*A\b(?!\s*Curve)(?![\w.-]*kA)/, "Current Rating", (m) => `${m[1]}A`);
  take(/(\d)\s*Pole\b/i, "Poles", (m) => `${m[1]} Pole`);
  take(/(\d+)\s*Modules?\b/i, "Modules", (m) => `${m[1]} Module`);
  // Distribution boards: SPN 8W DD IP43 - phase, ways, door.
  if (/\b(SPN|TPN)\b/.test(n) && /\b\d+\s*W(AY)?\b/i.test(n)) {
    take(/\b(SPN|TPN)\b/, "Phase", (m) => m[1]);
    take(/\b(\d+)\s*W(?:AY)?\b/i, "Ways", (m) => `${m[1]} Way`);
    take(/\b(DD|SD|GD|GLAZED)\b/, "Door", (m) => ({ DD: "Double Door", SD: "Single Door", GD: "Glazed", GLAZED: "Glazed" }[m[1]]));
  }
  take(/\b([BCD])[- ]?Curve\b/i, "Curve", (m) => `${m[1].toUpperCase()} Curve`);
  // MCCB trip unit is a real variant dim (DZ1N carries both in one line-up).
  take(/(Microprocessor Release(?:\s+iTRP\d*)?|Thermal-Magnetic Release)/i, "Release", (m) => /Micro/i.test(m[1]) ? "Microprocessor" : "Thermal-Magnetic");
  // Plates: trailing colour in parens, or "<Colour> Color"; orientation word.
  take(/\(([A-Z][A-Za-z ]{2,20})\)\s*$/, "Colour", (m) => m[1].trim());
  take(/\|\s*([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+Colou?r\b/, "Colour", (m) => m[1].trim());
  take(/\((Horizontal|Vertical|Square)\)/i, "Format", (m) => m[1]);
  take(/\b(Horizontal|Vertical|Square)\b/i, "Format", (m) => m[1]);

  const residue = n
    .replace(/[|,()]/g, " ")
    .replace(/[-–]\s+(?=\s|$)/g, " ")
    .replace(/(\d)\s+(kA|kVA|V|HP|W)\b/gi, "$1$2") // "10 kA" == "10kA"
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return { attrs, residue: `${category}::${residue}` };
}

/* ── group ── */
const byFamily = new Map();
for (const p of all) {
  if (p.parent_id) continue; // already grouped (idempotent re-runs)
  const { attrs, residue } = parse(p.name, p.category);
  if (!byFamily.has(residue)) byFamily.set(residue, []);
  byFamily.get(residue).push({ ...p, _attrs: attrs });
}

const numOf = (v) => { const m = String(v ?? "").match(/[\d.]+/); return m ? Number(m[0]) : Infinity; };
const stats = { families: 0, grouped: 0, standalone: 0, dupTuple: 0, over3dims: 0, singletons: 0 };
const report = [];
const updates = [];

for (const [key, members] of byFamily) {
  if (members.length < 2) { stats.singletons += members.length; continue; }

  // Differentiating dims = attr keys whose values vary across the family.
  const keys = [...new Set(members.flatMap((m) => Object.keys(m._attrs)))];
  const diffKeys = keys.filter((k) => new Set(members.map((m) => m._attrs[k] ?? "")).size > 1);
  if (diffKeys.length === 0) { stats.standalone += members.length; continue; }
  if (diffKeys.length > 3) { stats.over3dims += 1; stats.standalone += members.length; report.push(`OVER-3-DIMS (left standalone): ${key.slice(0, 90)} [${diffKeys.join(", ")}] x${members.length}`); continue; }

  // Unique tuple per member: when the store carries true duplicate listings
  // (same rating/poles twice under different SKUs), keep the family and evict
  // only the extra copies - the first by id stays in.
  const tuple = (m) => diffKeys.map((k) => m._attrs[k] ?? "").join("~");
  const seenTuples = new Set();
  const evicted = [];
  const uniqueMembers = [];
  for (const m of [...members].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const t = tuple(m);
    if (seenTuples.has(t)) evicted.push(m); else { seenTuples.add(t); uniqueMembers.push(m); }
  }
  if (evicted.length) { stats.dupTuple += evicted.length; stats.standalone += evicted.length; report.push(`DUPLICATE LISTINGS evicted (${evicted.length}) from: ${key.slice(0, 80)}`); }
  members.length = 0; members.push(...uniqueMembers);
  if (members.length < 2) { stats.standalone += members.length; continue; }

  // Parent = ascending numeric order on the differentiating dims.
  members.sort((a, b) => {
    for (const k of diffKeys) { const d = numOf(a._attrs[k]) - numOf(b._attrs[k]); if (d) return d; }
    return String(a.id).localeCompare(String(b.id));
  });
  const parent = members[0];
  stats.families += 1;
  stats.grouped += members.length;

  const esc = (s) => String(s).replace(/'/g, "''");
  for (const m of members) {
    // Store ALL parsed attrs (non-differentiating ones render as spec facts,
    // only differing keys become picker dims) - matches the wires model.
    const attrsJson = JSON.stringify(m._attrs);
    const parentSql = m.id === parent.id ? "null" : `'${esc(parent.id)}'`;
    updates.push(`update public.products set parent_id = ${parentSql}, attrs = coalesce(attrs, '{}'::jsonb) || '${esc(attrsJson)}'::jsonb where id = '${esc(m.id)}';`);
  }
}

const sql = `-- 0117: Lauritz Knudsen variant families (regrouping pass over 0114).
-- ${stats.families} families / ${stats.grouped} products grouped by parsing names into
-- attrs (Current Rating, Poles, Sensitivity, Modules, Ways, Door, Curve,
-- Colour, Format, Relay Range) + a residue family key. Families keep <=3
-- differentiating dims (owner hard rule); ambiguous or over-limit groups and
-- unparsed names stay standalone. Parent = smallest variant; variations point
-- parent_id at it. attrs merge over any existing jsonb. Idempotent: rows
-- already carrying parent_id are skipped at generation time.
${updates.join("\n")}
`;
writeFileSync("supabase/migrations/0117_lk-variants.sql", sql);

console.log(JSON.stringify(stats, null, 1));
console.log("\n-- issues --");
report.slice(0, 12).forEach((r) => console.log(" " + r));
console.log("\n-- 8 biggest families --");
const fams = [...byFamily.entries()].filter(([, m]) => m.length >= 2).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
for (const [key, members] of fams) {
  console.log(` ${key.slice(0, 86)}  x${members.length}`);
  members.slice(0, 3).forEach((m) => console.log(`    ${JSON.stringify(m._attrs)}`));
}
