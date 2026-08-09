#!/usr/bin/env node
/**
 * ABB variant families + site-wide dims cap → 0106_abb-variants-dims-cap.sql
 *
 * Part 1 - ABB (2,569 rows imported flat): parse each name+spec for the
 * category's variant dimensions, group products whose names are identical
 * once those tokens are removed, and wire them into families (parent_id +
 * attrs) so the PDP picker and card swatches work.
 *
 * HARD RULE (owner, Aug 2026): a family carries AT MOST 3 variant dimensions.
 * Category menus here honour it by construction:
 *   Switchgear   → Rating, Poles, + (Sensitivity | Curve, whichever varies)
 *   Modular      → Modules, Colour
 *   DB & Panels  → Ways, Type (SPN/TPN/VTPN)
 * Conservative by design: a family only forms when 2+ products share the
 * stripped base, every member has a value for every varying dim, and no two
 * members collide on the same value tuple. Anything ambiguous stays standalone.
 *
 * Part 2 - legacy cleanup for the same rule: drop the junk HSN attr key
 * everywhere (tax codes live in the hsn COLUMN, never a picker dim), then
 * for families still over 3 dims drop dims that are CONSTANT across the
 * family (a constant is information, not a picker). Families that still
 * exceed 3 after that are reported, not touched.
 */
import { readFileSync, writeFileSync } from "node:fs";

const all = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-divyejain-Desktop/2179ef71-ed46-4e6c-a800-dcbcf32a25bb/scratchpad/all-products.json", "utf8"));
const esc = (s) => String(s).replace(/'/g, "''");

/* ── Part 1: ABB families ── */
const COLOURS = "white|silver|black|grey|gray|gold|steel|graphite|ivory|champagne|anthracite|brown|beige";

function extract(cat, text) {
  const t = ` ${text} `;
  const dims = {};
  const consumed = [];
  const grab = (re, key, fmt) => {
    const m = t.match(re);
    if (m) { const v = m.slice(1).find(Boolean); if (v != null) { dims[key] = fmt ? fmt(v) : v; consumed.push(m[0]); } }
  };
  if (cat === "Switchgear") {
    const iso = t.match(/\bE20([234])\/(\d+)r?\b/i); // Isolator E204/125r → 4P 125A
    if (iso) { dims.Poles = `${iso[1]}P`; dims.Rating = `${iso[2]} A`; consumed.push(iso[0]); }
    if (!dims.Rating) grab(/[\s\-;](\d+(?:\.\d+)?)\s*A\b/i, "Rating", (v) => `${v} A`);
    if (!dims.Poles) grab(/\b([1-4])\s*P\b|\b(SPN|SP|DP|TPN|TP|FPN?)\b/i, "Poles", (v) => v.toUpperCase());
    grab(/(\d+)\s*mA\b/i, "Sensitivity", (v) => `${v} mA`);
    grab(/\b([BCDKZ])[\s-]*curve\b|curve\s*([BCDKZ])\b/i, "Curve", (v) => v.toUpperCase());
  } else if (cat === "Modular") {
    grab(/\b(\d+)\s*M(?:odule)?s?\b(?!\s*A)/i, "Modules", (v) => `${v}M`);
    grab(new RegExp(`\\b(${COLOURS})\\b`, "i"), "Colour", (v) => v[0].toUpperCase() + v.slice(1).toLowerCase());
  } else if (cat === "DB & Panels") {
    grab(/\b(\d+)\s*WAY/i, "Ways", (v) => `${v} way`);
    grab(/\b(SPN|TPN|VTPN|TPIN|DP)\b/i, "Type", (v) => v.toUpperCase());
  }
  return { dims, consumed };
}

const abb = all.filter((p) => p.brand === "ABB" && !p.parent_id);
const groups = new Map();
for (const p of abb) {
  const { dims, consumed } = extract(p.category, p.name);
  if (!Object.keys(dims).length) continue;
  let base = ` ${p.name} `;
  for (const c of consumed) base = base.replace(c, " ");
  base = `${p.category}|` + base.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  (groups.get(base) ?? groups.set(base, []).get(base)).push({ p, dims });
}

const upd = [];
let fams = 0, members = 0, skippedAmbiguous = 0;
for (const list of groups.values()) {
  if (list.length < 2) continue;
  // dims that actually vary across the family
  const keys = [...new Set(list.flatMap((m) => Object.keys(m.dims)))];
  const varying = keys.filter((k) => new Set(list.map((m) => m.dims[k] ?? "∅")).size > 1);
  if (!varying.length || varying.length > 3) { skippedAmbiguous++; continue; }
  // every member must hold every varying dim, and tuples must be unique
  const tuples = list.map((m) => varying.map((k) => m.dims[k] ?? null));
  if (tuples.some((tu) => tu.includes(null))) { skippedAmbiguous++; continue; }
  if (new Set(tuples.map((tu) => tu.join("|"))).size !== list.length) { skippedAmbiguous++; continue; }
  list.sort((a, b) => String(a.p.id).localeCompare(String(b.p.id)));
  const parent = list[0].p.id;
  fams++;
  for (const m of list) {
    const attrs = Object.fromEntries(varying.map((k) => [k, m.dims[k]]));
    upd.push(`update public.products set attrs = '${esc(JSON.stringify(attrs))}'::jsonb${m.p.id === parent ? "" : `, parent_id = '${esc(parent)}'`} where id = '${esc(m.p.id)}';`);
    members++;
  }
}

/* ── Part 2: dims cap on legacy families ── */
const capSql = [`-- Tax codes are never a variant dimension - the hsn COLUMN holds them.`,
  `update public.products set attrs = attrs - 'HSN' where attrs ? 'HSN';`];
const famMap = {};
for (const p of all) (famMap[p.parent_id ?? p.id] ??= []).push(p);
let stillOver = [];
for (const [fid, list] of Object.entries(famMap)) {
  if (list.length < 2) continue;
  const keys = [...new Set(list.flatMap((m) => Object.keys(m.attrs ?? {})))].filter((k) => k !== "HSN");
  if (keys.length <= 3) continue;
  // "Constant" = one distinct value among members that HAVE the key - a dim
  // that is missing on some members is not a picker dim either way.
  const constant = keys.filter((k) => new Set(list.map((m) => (m.attrs ?? {})[k]).filter((v) => v != null)).size <= 1);
  const toDrop = [];
  for (const k of constant) { if (keys.length - toDrop.length > 3) toDrop.push(k); }
  if (keys.length - toDrop.length > 3) { stillOver.push(fid); continue; }
  for (const k of toDrop) capSql.push(`update public.products set attrs = attrs - '${esc(k)}' where (parent_id = '${esc(fid)}' or id = '${esc(fid)}') and attrs ? '${esc(k)}';`);
}

const sql = `-- 0106: ABB variant families + the 3-dimension hard cap (owner rule, Aug 2026).
-- Part 1: ${fams} ABB families / ${members} members wired up (parent_id + attrs
-- parsed from ABB's structured names: rating/poles/sensitivity/curve for
-- switchgear, modules/colour for modular, ways/type for DBs). Conservative:
-- ambiguous groups stay standalone (${skippedAmbiguous} skipped).
-- Part 2: attrs.HSN dropped everywhere; over-cap legacy families lose their
-- CONSTANT dims until they fit 3. Idempotent.
-- After running: "Rebuild mappings now" in /admin/compare (attrs feed the
-- compare fingerprints).

${upd.join("\n")}

${capSql.join("\n")}
`;
writeFileSync("supabase/migrations/0106_abb-variants-dims-cap.sql", sql);
console.log(JSON.stringify({ abbFamilies: fams, abbMembers: members, skippedAmbiguous, legacyCapUpdates: capSql.length - 2, stillOver }));
