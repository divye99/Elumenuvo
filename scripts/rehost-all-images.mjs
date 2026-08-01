// Copy every externally-hosted product image (image_url + the images
// galleries) into OUR Supabase Storage, so no brand CDN change, takedown or
// hotlink block can ever break the store.
//
//   node scripts/rehost-all-images.mjs --audit   HEAD-check every external URL,
//                                                report dead ones. No key needed.
//   node scripts/rehost-all-images.mjs --apply   create the public bucket,
//                                                download+upload every external
//                                                image (deduped, resumable), and
//                                                EMIT migration 0083 repointing
//                                                image_url + images to our copies.
//                                                Needs SUPABASE_SERVICE_ROLE_KEY.
//
// DB writes stay in the migration file (0083) - nothing mutates products
// directly, consistent with migrations being run by hand. Failed/dead URLs are
// left untouched and reported (the client-side onError fallback covers them).
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const MODE = process.argv.includes("--apply") ? "apply" : "audit";
const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
const SERVICE = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const BUCKET = "product-images";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)";
const CONC = 8;

if (MODE === "apply" && !SERVICE) {
  console.error("--apply needs SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local).");
  process.exit(1);
}

/* ── 1. collect every product's external URLs ── */
const rows = [];
{
  let from = 0;
  for (;;) {
    const r = await fetch(`${SUPA}/rest/v1/products?select=id,image_url,images&is_active=eq.true&order=id&limit=1000&offset=${from}`, { headers: { apikey: ANON } });
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
}
const isExternal = (u) => typeof u === "string" && /^https?:\/\//.test(u) && !u.includes(".supabase.co/storage/");
const urlSet = new Set();
for (const p of rows) {
  if (isExternal(p.image_url)) urlSet.add(p.image_url);
  for (const u of Array.isArray(p.images) ? p.images : []) if (isExternal(u)) urlSet.add(u);
}
// The freshly-crawled galleries may not be in the DB yet (0082 pending):
// include them so the same run covers both states.
try {
  const hav = JSON.parse(await readFile("/tmp/hav-images.json", "utf8"));
  for (const p of hav) for (const u of p.images ?? []) if (isExternal(u)) urlSet.add(u);
} catch { /* no local crawl file: DB rows only */ }
const urls = [...urlSet];
console.log(`${rows.length} active products · ${urls.length} unique external image URLs`);

/* ── helpers ── */
const extOf = (u) => {
  const m = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.exec(u);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
};
const keyOf = (u) => `all/${createHash("sha1").update(u).digest("hex").slice(0, 20)}.${extOf(u)}`;
const publicUrl = (u) => `${SUPA}/storage/v1/object/public/${BUCKET}/${keyOf(u)}`;

async function pool(items, worker) {
  let i = 0; const out = new Array(items.length);
  await Promise.all(Array.from({ length: CONC }, async () => {
    for (;;) { const k = i++; if (k >= items.length) return; out[k] = await worker(items[k], k); }
  }));
  return out;
}

/* ── 2. AUDIT: is every external URL alive? ── */
async function check(u) {
  for (const method of ["HEAD", "GET"]) { // some CDNs reject HEAD; confirm with GET before declaring dead
    try {
      const r = await fetch(u, { method, headers: { "User-Agent": UA }, redirect: "follow" });
      if (r.ok) { if (method === "GET") r.body?.cancel?.(); return { u, ok: true }; }
      if (method === "GET") return { u, ok: false, status: r.status };
    } catch (e) {
      if (method === "GET") return { u, ok: false, status: String(e.message ?? e).slice(0, 60) };
    }
  }
  return { u, ok: false, status: "unreachable" };
}

if (MODE === "audit") {
  let done = 0;
  const res = await pool(urls, async (u) => {
    const r = await check(u);
    if (++done % 400 === 0) console.log(`  checked ${done}/${urls.length}`);
    return r;
  });
  const dead = res.filter((r) => !r.ok);
  const affected = rows.filter((p) =>
    dead.some((d) => d.u === p.image_url || (Array.isArray(p.images) && p.images.includes(d.u))));
  const report = [
    `# Dead image URLs · ${new Date().toISOString().slice(0, 10)} · ${dead.length} of ${urls.length} external URLs`,
    "",
    ...dead.map((d) => `${d.status} | ${d.u}`),
    "",
    `# Products affected (${affected.length}):`,
    ...affected.map((p) => `  ${p.id}`),
  ].join("\n");
  await writeFile("scripts/data/image-404-report.txt", report);
  console.log(`AUDIT: ${dead.length} dead of ${urls.length} · ${affected.length} products affected · scripts/data/image-404-report.txt`);
  process.exit(0);
}

/* ── 3. APPLY: bucket, upload, migration ── */
const admin = { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } };

// Public bucket (idempotent).
{
  const r = await fetch(`${SUPA}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...admin.headers, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (r.ok) console.log(`bucket ${BUCKET} created`);
  else {
    const t = await r.text();
    if (/already exists|Duplicate/i.test(t)) console.log(`bucket ${BUCKET} exists`);
    else { console.error(`bucket create failed: ${t}`); process.exit(1); }
  }
}

let done = 0, uploaded = 0, skipped = 0;
const failed = [];
const mapping = new Map(); // external url -> our url
await pool(urls, async (u) => {
  const key = keyOf(u);
  const our = publicUrl(u);
  try {
    // Resume: skip if our copy already exists.
    const head = await fetch(our, { method: "HEAD" });
    if (head.ok) { mapping.set(u, our); skipped++; }
    else {
      const src = await fetch(u, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(25000) });
      if (!src.ok) throw new Error(`source ${src.status}`);
      const buf = Buffer.from(await src.arrayBuffer());
      if (buf.length < 500) throw new Error(`suspiciously small (${buf.length}b)`);
      const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`, {
        method: "POST",
        headers: { ...admin.headers, "Content-Type": src.headers.get("content-type") ?? "image/jpeg", "x-upsert": "true" },
        body: buf,
      });
      if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 80)}`);
      mapping.set(u, our);
      uploaded++;
    }
  } catch (e) {
    failed.push(`${String(e.message ?? e).slice(0, 60)} | ${u}`);
  }
  if (++done % 250 === 0) console.log(`  ${done}/${urls.length} · up ${uploaded} · resume-skip ${skipped} · fail ${failed.length}`);
});
console.log(`uploads done: ${uploaded} new · ${skipped} already there · ${failed.length} failed`);

/* migration 0083: repoint every row whose URLs we now host */
const esc = (s) => s.replace(/'/g, "''");
const updates = [];
// Prefer the freshest gallery source: DB images if present, else the crawl file.
let crawlById = new Map();
try {
  crawlById = new Map(JSON.parse(await readFile("/tmp/hav-images.json", "utf8")).map((p) => [p.id, p.images ?? []]));
} catch { /* fine */ }
for (const p of rows) {
  const sets = [];
  if (isExternal(p.image_url) && mapping.has(p.image_url)) sets.push(`image_url = '${esc(mapping.get(p.image_url))}'`);
  const gal = (Array.isArray(p.images) && p.images.length ? p.images : crawlById.get(p.id) ?? []);
  if (gal.length) {
    const moved = gal.map((u) => (isExternal(u) && mapping.has(u) ? mapping.get(u) : u));
    if (JSON.stringify(moved) !== JSON.stringify(Array.isArray(p.images) ? p.images : []) && moved.some((u) => u.includes(".supabase.co/storage/"))) {
      sets.push(`images = '${esc(JSON.stringify(moved))}'::jsonb`);
    }
  }
  if (sets.length) updates.push(`update public.products set ${sets.join(", ")} where id = '${esc(p.id)}';`);
}
const sql = `-- 0083: images move HOME - every externally-hosted product photo now
-- serves from our own Supabase Storage bucket (${BUCKET}), immune to brand
-- CDN changes, takedowns and hotlink blocks. ${updates.length} products
-- repointed; URLs that failed to copy are left as-is and listed in
-- scripts/data/image-rehost-failures.txt. Run AFTER 0081/0082.
-- Generated by scripts/rehost-all-images.mjs --apply.

${updates.join("\n")}
`;
await writeFile("supabase/migrations/0083_rehost-images.sql", sql);
await writeFile("scripts/data/image-rehost-failures.txt",
  [`# URLs that could not be copied (${new Date().toISOString().slice(0, 10)}) - originals left in place`, ...failed].join("\n"));
console.log(`0083 written: ${updates.length} product updates · failures: ${failed.length} (scripts/data/image-rehost-failures.txt)`);
