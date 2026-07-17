import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Analytics ingest (see migration 0051). Called via sendBeacon; always
 * answers 204 fast and never surfaces an error to the shopper. Enriches each
 * batch server-side with IP, Vercel edge geolocation and a device summary,
 * then writes with the service role (the table has no public policies).
 */

export const runtime = "nodejs";

const ok = () => new NextResponse(null, { status: 204 });

function deviceOf(ua: string): string {
  const os =
    /iPhone|iPad/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X/.test(ua) ? "macOS" :
    /Linux/.test(ua) ? "Linux" : "Other";
  const br =
    /Edg\//.test(ua) ? "Edge" :
    /OPR\//.test(ua) ? "Opera" :
    /SamsungBrowser/.test(ua) ? "Samsung Internet" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Safari\//.test(ua) ? "Safari" : "Other";
  const form = /Mobile|iPhone|Android(?!.*Tablet)/.test(ua) ? "mobile" : /iPad|Tablet/.test(ua) ? "tablet" : "desktop";
  return `${os} · ${br} · ${form}`;
}

const geo = (h: Headers, k: string) => {
  const v = h.get(k);
  try { return v ? decodeURIComponent(v).slice(0, 80) : null; } catch { return v?.slice(0, 80) ?? null; }
};

export async function POST(request: Request) {
  let body: { sid?: unknown; events?: unknown };
  try { body = await request.json(); } catch { return ok(); }

  const sid = String(body.sid ?? "").slice(0, 40);
  const events = Array.isArray(body.events) ? body.events.slice(0, 25) : [];
  if (!sid || !events.length) return ok();

  const db = adminClient();
  if (!db) return ok(); // local dev without the service key

  const h = request.headers;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 60) || null;
  const device = deviceOf(h.get("user-agent") ?? "");
  const country = geo(h, "x-vercel-ip-country");
  const region = geo(h, "x-vercel-ip-country-region");
  const city = geo(h, "x-vercel-ip-city");

  const ALLOWED = new Set(["pageview", "leave", "click", "product_click", "add_to_cart", "identify"]);
  const rows = [];
  for (const e of events as Record<string, unknown>[]) {
    const type = String(e?.type ?? "");
    if (!ALLOWED.has(type)) continue;
    rows.push({
      sid,
      type,
      path: e.path ? String(e.path).slice(0, 300) : null,
      detail: e.detail && typeof e.detail === "object" ? e.detail : null,
      referrer: e.referrer ? String(e.referrer).slice(0, 300) : null,
      device,
      ip,
      country,
      region,
      city,
      duration_ms: Number.isFinite(Number(e.duration_ms)) ? Math.max(0, Math.min(30 * 60_000, Math.round(Number(e.duration_ms)))) : null,
      email: e.email ? String(e.email).slice(0, 200) : null,
      name: e.name ? String(e.name).slice(0, 140) : null,
    });
  }
  if (!rows.length) return ok();

  try { await db.from("site_events").insert(rows); } catch { /* analytics must never break the site */ }
  return ok();
}
