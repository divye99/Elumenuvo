#!/usr/bin/env node
/**
 * One-time: re-write every object in the product-images bucket with
 * cacheControl 31536000 (1 year). They were uploaded without cacheControl,
 * which Supabase serves as `cache-control: no-cache` - so every product-image
 * view by every visitor AND crawler re-downloaded the bytes from Supabase.
 * That made storage the dominant egress driver (Aug 2026).
 *
 * Metadata is not editable in place, so each object is downloaded once and
 * re-uploaded (upsert) with the header - a one-time ~0.5 GB round trip that
 * ends the per-view egress. Safe to re-run; skips nothing (idempotent result).
 */
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "product-images";

async function listAll(prefix) {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const o of data) {
      const path = prefix ? `${prefix}/${o.name}` : o.name;
      if (o.id) out.push(path);        // file
      else out.push(...(await listAll(path))); // folder - recurse
    }
    if (data.length < 1000) break;
  }
  return out;
}

const paths = await listAll("");
console.error(`objects: ${paths.length}`);

let done = 0, failed = 0;
const CONC = 8;
let idx = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (idx < paths.length) {
    const path = paths[idx++];
    try {
      const dl = await db.storage.from(BUCKET).download(path);
      if (dl.error) throw new Error(dl.error.message);
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const up = await db.storage.from(BUCKET).upload(path, buf, {
        contentType: dl.data.type || "image/jpeg",
        upsert: true,
        cacheControl: "31536000",
      });
      if (up.error) throw new Error(up.error.message);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAIL ${path}: ${e.message}`);
    }
    if ((done + failed) % 250 === 0) console.error(`${done + failed}/${paths.length} (${failed} failed)`);
  }
}));
console.log(JSON.stringify({ total: paths.length, done, failed }));
