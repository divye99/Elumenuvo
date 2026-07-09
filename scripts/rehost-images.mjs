/**
 * Re-host hotlinked product images to Supabase Storage. The BOE catalogue import
 * left image_url pointing at bestofelectricals' CDN — this downloads each and
 * uploads it to the `product-images` bucket, then repoints products.image_url.
 *
 *   node --env-file=.env.local scripts/rehost-images.mjs           # dry run (counts only)
 *   node --env-file=.env.local scripts/rehost-images.mjs --apply   # download → upload → repoint
 *
 * Env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY.
 * Idempotent: rows already on Supabase storage are skipped.
 */
import { createClient } from "@supabase/supabase-js";

if (typeof globalThis.WebSocket === "undefined") {
  try { globalThis.WebSocket = (await import("ws")).default; } catch { /* native WS on Node 22+ */ }
}
const _fetch = globalThis.fetch;
globalThis.fetch = (u, o = {}) => _fetch(u, { ...o, signal: o.signal ?? AbortSignal.timeout(25000) });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const APPLY = process.argv.includes("--apply");
const BUCKET = "product-images";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36";

if (!SUPABASE_URL || !SERVICE_KEY) { console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const contentType = (u) => (/\.png$/i.test(u) ? "image/png" : /\.webp$/i.test(u) ? "image/webp" : /\.gif$/i.test(u) ? "image/gif" : "image/jpeg");
const ext = (u) => (contentType(u).split("/")[1] || "jpg").replace("jpeg", "jpg");

async function readAll(cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("products").select(cols).not("image_url", "is", null).order("id").range(from, from + 999);
    if (error) { console.error("Read products failed:", error.message); process.exit(1); }
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

async function rehostOne(p) {
  try {
    const res = await fetch(p.image_url, { headers: { "User-Agent": UA } });
    if (!res.ok) return { id: p.id, ok: false, why: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) return { id: p.id, ok: false, why: "empty" };
    const path = `rehosted/${p.id}.${ext(p.image_url)}`;
    const up = await db.storage.from(BUCKET).upload(path, buf, { contentType: contentType(p.image_url), upsert: true });
    if (up.error) return { id: p.id, ok: false, why: up.error.message };
    const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    const { error } = await db.from("products").update({ image_url: url }).eq("id", p.id);
    if (error) return { id: p.id, ok: false, why: error.message };
    return { id: p.id, ok: true };
  } catch (e) {
    return { id: p.id, ok: false, why: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function main() {
  const rows = await readAll("id, image_url");
  // Only external hotlinks (skip anything already on our Supabase storage).
  const hotlinked = rows.filter((p) => typeof p.image_url === "string" && !p.image_url.includes(".supabase.co/storage/") && /^https?:\/\//.test(p.image_url));
  const boe = hotlinked.filter((p) => p.image_url.includes("bestofelectricals"));
  const otherExternal = hotlinked.filter((p) => !p.image_url.includes("bestofelectricals"));

  console.log(`${rows.length} products with an image; ${hotlinked.length} hotlinked externally (${boe.length} BOE, ${otherExternal.length} other).`);
  if (!APPLY) { console.log("\nDry run — re-run with --apply to download + re-host them."); return; }

  let ok = 0, fail = 0;
  const CONCURRENCY = 5;
  for (let i = 0; i < hotlinked.length; i += CONCURRENCY) {
    const res = await Promise.all(hotlinked.slice(i, i + CONCURRENCY).map(rehostOne));
    for (const r of res) { if (r.ok) ok++; else { fail++; console.warn(`  ✗ ${r.id}: ${r.why}`); } }
    process.stdout.write(`  ${Math.min(i + CONCURRENCY, hotlinked.length)}/${hotlinked.length} (ok ${ok}, fail ${fail})\n`);
  }
  console.log(`\nDone. Re-hosted ${ok}, failed ${fail}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
