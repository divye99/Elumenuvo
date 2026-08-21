#!/usr/bin/env node
// Drop the production catalogue cache after a backfill script or raw SQL.
//   node scripts/revalidate-catalogue.mjs            (targets https://elumenuvo.com)
//   SITE=http://localhost:3006 node scripts/revalidate-catalogue.mjs
// Reads SUPABASE_SERVICE_ROLE_KEY from .env.local (same key the scripts use)
// and mints a 5-minute token; the key itself never leaves this machine.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")]; }),
);
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("SUPABASE_SERVICE_ROLE_KEY missing"); process.exit(1); }
const exp = Date.now() + 5 * 60_000;
const token = `${exp}.${createHmac("sha256", key).update(`revalidate.${exp}`).digest("base64url")}`;
const site = process.env.SITE || "https://elumenuvo.com";
const r = await fetch(`${site}/api/admin/revalidate`, { method: "POST", headers: { "x-revalidate-token": token } });
console.log(r.status, await r.text());
process.exit(r.ok ? 0 : 1);
