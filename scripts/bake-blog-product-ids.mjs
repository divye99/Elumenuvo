// Bake hand-curated productId into each top-10 blog item. Only exact/range
// matches get an id; ranked products we don't stock stay null (no button:
// selling a lookalike under another product's heading would mislead).
// Verifies every id exists in the live catalogue before writing.
import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local", quiet: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// The wires ids came from the matcher; easier to re-run the matcher logic for
// accepted ranks than to hand-copy ids. Accepted (file -> ranks):
const ACCEPT = {
  "top-10-house-wires-cables-india.json": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "top-10-ceiling-fans-india.json": [1, 3, 7, 8],
  "top-10-distribution-boards-india.json": [1, 3],
  "top-10-led-lights-india.json": [1, 3, 4],
  "top-10-mcbs-switchgear-india.json": [2, 3, 9],
  "top-10-modular-switches-sockets-india.json": [], // override below
};
// Manual overrides where the auto-match picked a poor representative.
const OVERRIDE = {
  "top-10-modular-switches-sockets-india.json": { 4: "hav-ahcsdiw321" }, // Coral 32A DP switch, not a cover frame
};

let all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("products").select("id, brand, category, name, elume_price, is_recommended").range(from, from + 999);
  if (error) { console.error("ERR", error.message); process.exit(1); }
  all.push(...data);
  if (data.length < 1000) break;
}
const byId = new Map(all.map((p) => [p.id, p]));
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9. ]/g, " ").replace(/\s+/g, " ");

for (const f of Object.keys(ACCEPT)) {
  const path = "src/content/blog/" + f;
  const d = JSON.parse(fs.readFileSync(path));
  for (const it of d.items) {
    let id = OVERRIDE[f]?.[it.rank] ?? null;
    if (!id && ACCEPT[f].includes(it.rank)) {
      const toks = norm(it.name).split(" ").filter((t) => t.length > 2 && !["the", "and", "with", "for"].includes(t));
      const scored = all
        .filter((p) => p.brand.toLowerCase() === it.brand.toLowerCase() && p.category === d.category)
        .map((p) => { const pn = norm(p.name); let sc = 0; for (const t of toks) if (pn.includes(t)) sc++; if (p.is_recommended) sc += 0.4; return { p, sc }; })
        .sort((a, b) => b.sc - a.sc || Number(a.p.elume_price) - Number(b.p.elume_price));
      if (scored[0] && scored[0].sc >= 1) id = scored[0].p.id;
    }
    if (id && !byId.has(id)) { console.error("MISSING id", id, "for", f, it.rank); process.exit(1); }
    it.productId = id;
    if (id) console.log(f.slice(7, 20), "#" + it.rank, "->", byId.get(id).name.slice(0, 60), "₹" + byId.get(id).elume_price);
  }
  fs.writeFileSync(path, JSON.stringify(d, null, 2) + "\n");
}
console.log("baked.");
