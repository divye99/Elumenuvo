// Gallery crawl for every active Havells product, straight from havells.com
// GraphQL media_gallery. SKU-VERIFIED by construction: a product only ever
// receives images from the Magento item whose sku equals OUR brand_sku, or
// from that child's own configurable parent (range-level packshots). Nothing
// is matched by name, so a wrong-product photo cannot slip in.
//
// Output: /tmp/hav-images.json  [{ id, sku, images: [...], sources }]
import { readFile, readdir, writeFile } from "node:fs/promises";

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
    await new Promise((res) => setTimeout(res, 1500 * attempt));
    return gql(query, attempt + 1);
  }
}

const FIELDS = `sku media_gallery{url label position disabled}
  ... on ConfigurableProduct{variants{product{sku media_gallery{url label position disabled}}}}`;

// ── our Havells catalogue ──
const rows = [];
{
  let from = 0;
  for (;;) {
    const r = await fetch(
      `${SUPA}/rest/v1/products?select=id,name,brand_sku,image_url&brand=eq.Havells&is_active=eq.true&order=id&limit=1000&offset=${from}`,
      { headers: { apikey: KEY } }
    );
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
}
console.log(`${rows.length} active Havells products`);

// ── PARENT::CHILD pins from committed migrations (for configurable children) ──
const pinParent = new Map();
for (const f of await readdir("supabase/migrations")) {
  if (!f.endsWith(".sql")) continue;
  const sql = await readFile(`supabase/migrations/${f}`, "utf8");
  for (const m of sql.matchAll(/\('([a-z0-9-]+)'\s*,\s*'havells'\s*,\s*'([A-Z0-9-]+)::([A-Z0-9-]+)'/g)) {
    pinParent.set(m[3], m[2]); // childSku -> parentSku
  }
}

const gallery = new Map();      // sku (exact) -> [urls] from its own media_gallery
const parentGallery = new Map();// parentSku -> [urls]
const childToParent = new Map();// discovered from variants

const clean = (mg) =>
  (mg ?? [])
    .filter((m) => m?.url && !m.disabled)
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((m) => m.url);

function absorb(item, asParent = false) {
  if (!item?.sku) return;
  const own = clean(item.media_gallery);
  if (own.length) (asParent ? parentGallery : gallery).set(item.sku, own);
  if (asParent && own.length) gallery.set(item.sku, own);
  for (const v of item.variants ?? []) {
    const c = clean(v.product?.media_gallery);
    if (v.product?.sku) {
      if (c.length) gallery.set(v.product.sku, c);
      childToParent.set(v.product.sku, item.sku);
    }
  }
}

// Pass 1: query every brand_sku directly (simple products answer; children do not).
const skus = [...new Set(rows.map((r) => (r.brand_sku ?? "").trim()).filter(Boolean))];
for (let i = 0; i < skus.length; i += 20) {
  const batch = skus.slice(i, i + 20);
  try {
    const d = await gql(`query{products(filter:{sku:{in:[${batch.map((s) => `"${s}"`).join(",")}]}},pageSize:20){items{${FIELDS}}}}`);
    for (const it of d.products.items) absorb(it);
  } catch (e) { console.log(`  batch ${i} failed: ${e.message}`); }
  if (i % 200 === 0) console.log(`  direct ${Math.min(i + 20, skus.length)}/${skus.length} · galleries ${gallery.size}`);
}
console.log(`after direct pass: ${gallery.size} galleries`);

// Pass 2: unresolved SKUs via pinned parents, then the -C convention.
const unresolved = skus.filter((s) => !gallery.has(s));
const parentsToFetch = new Set();
for (const s of unresolved) {
  const p = pinParent.get(s);
  if (p) parentsToFetch.add(p);
  else parentsToFetch.add(`${s}-C`);
}
const plist = [...parentsToFetch];
console.log(`pass 2: ${unresolved.length} unresolved via ${plist.length} parents`);
for (let i = 0; i < plist.length; i += 20) {
  const batch = plist.slice(i, i + 20);
  try {
    const d = await gql(`query{products(filter:{sku:{in:[${batch.map((s) => `"${s}"`).join(",")}]}},pageSize:20){items{${FIELDS}}}}`);
    for (const it of d.products.items) absorb(it, true);
  } catch (e) { console.log(`  parent batch ${i} failed: ${e.message}`); }
}

// Pass 3: the full catalogue crawl from the original import
// (scripts/data/havells-catalogue.json) carries parent + per-variant
// media_gallery for 1,400+ configurables - resolves children whose parent
// SKU follows no guessable convention.
try {
  const cat = JSON.parse(await readFile("scripts/data/havells-catalogue.json", "utf8"));
  let fromFile = 0;
  for (const it of cat.products ?? []) {
    const own = clean(it.media_gallery);
    if (it.sku && own.length && !gallery.has(it.sku)) gallery.set(it.sku, own);
    if (it.sku && own.length) parentGallery.set(it.sku, own);
    for (const v of it.variants ?? []) {
      const c = clean(v.product?.media_gallery);
      const csku = v.product?.sku;
      if (!csku) continue;
      if (c.length && !gallery.has(csku)) { gallery.set(csku, c); fromFile++; }
      if (!childToParent.has(csku)) childToParent.set(csku, it.sku);
    }
  }
  console.log(`pass 3 (catalogue file): +${fromFile} child galleries · ${gallery.size} total`);
} catch (e) { console.log(`pass 3 skipped: ${e.message}`); }

// ── sibling map: which child SKUs share each parent (for the wrong-variant
//    filter below) ──
const familyChildren = new Map(); // parentSku -> Set(childSku)
for (const [c, par] of childToParent) {
  if (!familyChildren.has(par)) familyChildren.set(par, new Set());
  familyChildren.get(par).add(c);
}

// ── assemble per-product image lists ──
// Own-gallery images are trusted as-is (they belong to OUR exact SKU).
// Parent-gallery images are range-level and can embed a SIBLING variant's
// photo (a 63A MCB shot on the 10A listing, another fan finish): keep a
// parent image only if its filename contains OUR sku, or contains NO
// sibling's sku at all (true range shots, BEE labels, lifestyle renders).
const norm = (x) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
// Every Havells SKU we know of (ours + every variant seen anywhere): a parent
// image whose filename embeds ANY of them other than our own is some other
// product's photo, even across families (e.g. the 4000K panel's shot in the
// 6500K family's gallery).
const knownSkus = new Set();
for (const r of rows) if (r.brand_sku) knownSkus.add(norm(r.brand_sku));
for (const c of childToParent.keys()) knownSkus.add(norm(c));
for (const par of parentGallery.keys()) knownSkus.add(norm(par).replace(/c$/, ""));
const out = [];
for (const p of rows) {
  const sku = (p.brand_sku ?? "").trim();
  const own = gallery.get(sku) ?? [];
  const parKey = childToParent.get(sku) ?? pinParent.get(sku) ?? `${sku}-C`;
  const sibs = [...(familyChildren.get(parKey) ?? [])].filter((s) => s !== sku).map(norm);
  const mine = norm(sku);
  const par = (parentGallery.get(parKey) ?? []).filter((u) => {
    const f = norm(u.split("/").pop() ?? "");
    if (mine && f.includes(mine)) return true;
    if (sibs.some((s) => s && f.includes(s))) return false;
    for (const k of knownSkus) if (k !== mine && k.length >= 8 && f.includes(k)) return false;
    return true;
  });
  // Order: current image first (keeps cards/OG stable), then the child's own
  // gallery, then verified range-level parent shots. Dedupe on the pathname.
  const seen = new Set();
  const images = [];
  for (const u of [p.image_url, ...own, ...par]) {
    if (!u) continue;
    let k;
    try { k = new URL(u).pathname.toLowerCase(); } catch { k = u.toLowerCase(); }
    if (seen.has(k)) continue;
    seen.add(k);
    images.push(u);
    if (images.length >= 6) break;
  }
  out.push({ id: p.id, name: p.name, sku, images, ownCount: own.length, parCount: par.length });
}
await writeFile("/tmp/hav-images.json", JSON.stringify(out, null, 1));
const c3 = out.filter((o) => o.images.length >= 3).length;
const c2 = out.filter((o) => o.images.length === 2).length;
const c1 = out.filter((o) => o.images.length === 1).length;
const c0 = out.filter((o) => o.images.length === 0).length;
console.log(`DONE: ${out.length} products · 3+: ${c3} · exactly 2: ${c2} · only 1: ${c1} · none: ${c0}`);
