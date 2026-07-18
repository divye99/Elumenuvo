// Dry-run matcher: map each top-10 blog item to a real catalogue product.
// Prints proposed matches; --write bakes productId into the JSON files.
import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
dotenv.config({ path: ".env.local", quiet: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const WRITE = process.argv.includes("--write");

let all = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from("products")
    .select("id, brand, category, name, elume_price, mrp, is_recommended")
    .range(from, from + 999);
  if (error) { console.error("ERR", error.message); process.exit(1); }
  all.push(...data);
  if (data.length < 1000) break;
}
console.log("catalogue:", all.length);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9. ]/g, " ").replace(/\s+/g, " ");
const files = fs.readdirSync("src/content/blog").filter((f) => f.endsWith(".json"));

for (const f of files) {
  const path = "src/content/blog/" + f;
  const d = JSON.parse(fs.readFileSync(path));
  console.log("\n== " + f + " (" + d.category + ")");
  for (const it of d.items) {
    const toks = norm(it.name).split(" ").filter((t) => t.length > 2 && !["the", "and", "with", "for"].includes(t));
    const cands = all.filter((p) => p.brand.toLowerCase() === it.brand.toLowerCase() && p.category === d.category);
    const scored = cands
      .map((p) => {
        const pn = norm(p.name);
        let sc = 0;
        for (const t of toks) if (pn.includes(t)) sc++;
        if (p.is_recommended) sc += 0.4;
        return { p, sc };
      })
      .sort((a, b) => b.sc - a.sc || Number(a.p.elume_price) - Number(b.p.elume_price));
    const best = scored[0];
    const hit = best && best.sc >= 1 ? best.p : null;
    it.productId = hit ? hit.id : null;
    console.log(
      String(it.rank).padStart(2), "|",
      (it.brand + " " + it.name).slice(0, 50).padEnd(50), "->",
      hit ? hit.name.slice(0, 58) + " ₹" + hit.elume_price + " [" + best.sc.toFixed(1) + "]" : "NO MATCH (" + cands.length + " brand+cat cands)"
    );
  }
  if (WRITE) fs.writeFileSync(path, JSON.stringify(d, null, 2) + "\n");
}
if (WRITE) console.log("\nproductId written into JSONs");
