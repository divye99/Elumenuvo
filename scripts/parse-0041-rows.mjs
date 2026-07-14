#!/usr/bin/env node
/**
 * Extract product rows from the generated 0041 insert tuples into JSON the
 * auto-mapper can consume via EXTRA_ROWS_FILE (covers rows the user has not
 * applied to the DB yet). Writes scripts/data/havells-import-rows.json.
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIG = path.join(ROOT, "supabase/migrations");

// Tokenize one SQL VALUES tuple: strings with '' escapes, numbers, null, jsonb.
function parseTuple(line) {
  const vals = [];
  let i = 1; // skip opening (
  while (i < line.length) {
    const c = line[i];
    if (c === "'") {
      let s = "", j = i + 1;
      for (;;) {
        if (line[j] === "'" && line[j + 1] === "'") { s += "'"; j += 2; continue; }
        if (line[j] === "'") break;
        s += line[j++];
      }
      i = j + 1;
      if (line.slice(i, i + 7) === "::jsonb") i += 7;
      vals.push(s);
    } else if (/[-\d]/.test(c)) {
      let j = i;
      while (/[-\d.]/.test(line[j])) j++;
      vals.push(Number(line.slice(i, j)));
      i = j;
    } else if (line.slice(i, i + 4) === "null") { vals.push(null); i += 4; }
    else if (line.slice(i, i + 4) === "true") { vals.push(true); i += 4; }
    else if (line.slice(i, i + 5) === "false") { vals.push(false); i += 5; }
    else i++; // comma, space, closing paren
    if (line[i] === ")" && (line[i + 1] === "," || line[i + 1] === undefined || line.slice(i + 1, i + 3) === "\no")) break;
  }
  return vals;
}

const rows = [];
for (const f of readdirSync(MIG).filter((x) => /^0041_havells-import-part\d+\.sql$/.test(x)).sort()) {
  for (const line of readFileSync(path.join(MIG, f), "utf8").split("\n")) {
    if (!line.startsWith("('hav-") && !line.startsWith("('")) continue;
    if (line.startsWith("('") === false) continue;
    const v = parseTuple(line);
    if (v.length < 15 || v[3] !== "Havells") continue;
    // (id, sku, name, brand, category, spec, mrp, elume_price, unit, image_url, attrs, brand_sku, parent_id, tech_specs, is_active)
    rows.push({ id: v[0], name: v[2], brand: "Havells", brand_sku: v[11], category: v[4], spec: v[5], unit: v[8], parent_id: v[12], attrs: v[10] ? JSON.parse(v[10]) : null, elume_price: v[7] });
  }
}
writeFileSync(path.join(ROOT, "scripts/data/havells-import-rows.json"), JSON.stringify(rows, null, 1));
console.log(`Parsed ${rows.length} rows from 0041 files.`);
const sample = rows.find((r) => r.attrs?.Length === "180 m");
console.log("sample:", JSON.stringify(sample));
