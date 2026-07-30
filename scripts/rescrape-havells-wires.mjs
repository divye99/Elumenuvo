// Re-scrape Havells wire data straight from havells.com GraphQL:
//   - VERIFIED coil length per child SKU (the configurable's `length` option)
//   - colour label per child SKU
//   - the parent's own description/short_description (per-SKU brand copy)
// Output: /tmp/hav-wire-truth.json  (product_id → verified facts)
//
// Child SKUs are invisible to Magento sku filters, so parents are fetched and
// children matched inside `variants`. Parent SKUs come from the PARENT::CHILD
// pins in supabase/migrations (0066) plus the -C convention as fallback.
import { readFile, writeFile, readdir } from "node:fs/promises";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function gql(query, attempt = 1) {
  try {
    const r = await fetch(`https://havells.com/graphql?query=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    if (d.errors) throw new Error(d.errors[0]?.message ?? "gql error");
    return d.data;
  } catch (e) {
    if (attempt >= 4) throw e;
    await new Promise((res) => setTimeout(res, 1200 * attempt));
    return gql(query, attempt + 1);
  }
}

// ── 1. Our Havells wires ──
const rows = [];
{
  let from = 0;
  for (;;) {
    const r = await fetch(
      `${SUPA}/rest/v1/products?select=id,name,brand_sku,tech_specs,attrs&brand=eq.Havells&category=eq.${encodeURIComponent("Wires & Cables")}&is_active=eq.true&order=id&limit=500&offset=${from}`,
      { headers: { apikey: KEY } }
    );
    const page = await r.json();
    rows.push(...page);
    if (page.length < 500) break;
    from += 500;
  }
}
console.log(`${rows.length} Havells wires in catalogue`);

// ── 2. PARENT::CHILD pins from the committed migrations ──
const pinByProduct = new Map();
for (const f of await readdir("supabase/migrations")) {
  if (!f.endsWith(".sql")) continue;
  const sql = await readFile(`supabase/migrations/${f}`, "utf8");
  for (const m of sql.matchAll(/\('([a-z0-9-]+)'\s*,\s*'havells'\s*,\s*'([A-Z0-9-]+)::([A-Z0-9-]+)'/g)) {
    pinByProduct.set(m[1], { parent: m[2], child: m[3] });
  }
}
console.log(`${pinByProduct.size} PARENT::CHILD pins found in migrations`);

// ── 3. Parent SKU per wire (pin first, -C convention as fallback) ──
const parents = new Set();
const wanted = []; // { id, name, childSku, parentSku }
for (const p of rows) {
  const pin = pinByProduct.get(p.id);
  const childSku = pin?.child ?? (p.brand_sku || "").trim();
  if (!childSku) continue;
  const parentSku = pin?.parent ?? null; // null → resolve by probing later
  wanted.push({ id: p.id, name: p.name, childSku, parentSku, tech_specs: p.tech_specs, attrs: p.attrs });
  if (parentSku) parents.add(parentSku);
}
const unpinned = wanted.filter((w) => !w.parentSku);
console.log(`${wanted.length} wires with a child SKU · ${unpinned.length} without a parent pin`);

// ── 4. Batch-fetch parents: options + variants + brand copy ──
const FIELDS = `sku name url_key description{html} short_description{html}
  ... on ConfigurableProduct{
    configurable_options{attribute_code values{label}}
    variants{attributes{code label} product{sku name}}
  }`;
const bySku = new Map(); // parentSku → item
const list = [...parents];
for (let i = 0; i < list.length; i += 20) {
  const batch = list.slice(i, i + 20);
  const d = await gql(`query{products(filter:{sku:{in:[${batch.map((s) => `"${s}"`).join(",")}]}},pageSize:20){items{${FIELDS}}}}`);
  for (const it of d.products.items) bySku.set(it.sku, it);
  console.log(`parents ${Math.min(i + 20, list.length)}/${list.length}`);
}

// Unpinned wires: try SKU as its own parent, then the -C suffix.
for (const w of unpinned) {
  for (const cand of [w.childSku, `${w.childSku}-C`]) {
    if (bySku.has(cand)) { w.parentSku = cand; break; }
    try {
      const d = await gql(`query{products(filter:{sku:{eq:"${cand}"}}){items{${FIELDS}}}}`);
      if (d.products.items.length) { bySku.set(cand, d.products.items[0]); w.parentSku = cand; break; }
    } catch { /* keep trying */ }
  }
}

// ── 5. Assemble the truth file ──
const strip = (html) => (html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const out = [];
let noParent = 0, noChild = 0;
for (const w of wanted) {
  const parent = w.parentSku ? bySku.get(w.parentSku) : null;
  if (!parent) { noParent++; out.push({ id: w.id, name: w.name, status: "no-parent", childSku: w.childSku }); continue; }
  const variants = parent.variants ?? [];
  const hit = variants.find((v) => v.product?.sku === w.childSku);
  const attrs = hit ? Object.fromEntries(hit.attributes.map((a) => [a.code, a.label])) : null;
  if (!hit) noChild++;
  out.push({
    id: w.id,
    name: w.name,
    status: hit ? "ok" : "child-not-in-parent",
    childSku: w.childSku,
    parentSku: parent.sku,
    parentName: parent.name,
    length: attrs?.length ?? null,          // e.g. "90 m" - VERIFIED from havells.com
    color: attrs?.color ?? null,
    desc: strip(parent.description?.html),
    shortDesc: strip(parent.short_description?.html),
    curTechSpecs: w.tech_specs ?? null,
    curAttrs: w.attrs ?? null,
  });
}
await writeFile("/tmp/hav-wire-truth.json", JSON.stringify(out, null, 1));
const withLen = out.filter((o) => o.length).length;
console.log(`DONE: ${out.length} wires · ${withLen} with a verified length · ${noParent} no-parent · ${noChild} child-not-in-parent`);
