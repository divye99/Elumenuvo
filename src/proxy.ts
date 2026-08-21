import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";
import { BOT_RE, isStaleBrowser } from "@/lib/bots";

/** Next 16 "proxy" convention (formerly middleware). Two jobs:
 *
 *  1. Scraper-fleet block (owner, after the 21 Aug 2026 database outage).
 *     A residential-proxy botnet pulled 11,000+ product pages a day from
 *     ~1,800 IPs, rotating a handful of frozen browser UAs (Chrome 118-120,
 *     Firefox 120-121) plus the Lightpanda headless browser, and ran our
 *     client JS, so every visit also fired the personalisation endpoint and
 *     the analytics beacon against Postgres. Those UAs are the same
 *     "objective evidence" the analytics bot classifier already uses: no
 *     auto-updating human browser reports a major ~25 versions old. Such
 *     requests get a plain 403 before any render or query. Search engines
 *     (Googlebot, Bingbot) carry their own UA tokens and evergreen Chrome
 *     versions, so they never match.
 *  2. Refreshes the Supabase auth session for the buyer app (/app) and the
 *     Elumenuvo (space) portal. */
const HEADLESS_RE = /lightpanda|headlesschrome|phantomjs|puppeteer|playwright/i;

const BLOCKED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Please update your browser · Elume</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F6F7FB;color:#16215B;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:520px;background:#fff;border:1px solid #E8EBF1;border-radius:16px;padding:32px}h1{font-size:22px;margin:0 0 12px}p{line-height:1.6;margin:0 0 12px;color:#2c3550}a{color:#1D2F8A}</style></head><body><main><h1>Please update your browser to open Elume</h1><p>This browser version is several years old, and automated traffic using the same version was recently overloading the site, so it is not served for now.</p><p>Updating Chrome, Edge, Firefox or Safari to a current version fixes this in a minute. If you cannot update, we are happy to help by phone or email:</p><p><a href="tel:+919818821175">+91 98188 21175</a> · <a href="mailto:info@elumenuvo.com">info@elumenuvo.com</a></p></main></body></html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/app") || pathname.startsWith("/space/portal")) return await updateSession(request);
  const ua = request.headers.get("user-agent") ?? "";
  // Honest crawlers (Googlebot, Bingbot, Applebot, the AI answer engines,
  // link previewers) say who they are and are welcome; some carry an
  // old-looking browser token (Applebot reports Safari 13), so they are
  // exempt from the stale-browser test. We block disguises, not bots that
  // identify themselves; robots.txt governs those.
  if (HEADLESS_RE.test(ua) || (!BOT_RE.test(ua) && isStaleBrowser(ua))) {
    // A real person on a years-old, never-updated browser lands here too
    // (rare, but office PCs exist): tell them why, and how to reach us.
    return new NextResponse(BLOCKED_HTML, { status: 403, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app", "/app/:path*", "/space/portal", "/space/portal/:path*",
    "/", "/catalogue/:path*", "/compare/:path*", "/brand/:path*", "/category/:path*",
    "/price-list/:path*", "/collections/:path*", "/for-you", "/search",
    "/api/personal/:path*", "/api/me/:path*", "/api/track", "/api/explore-log", "/api/search-log", "/api/suggest",
  ],
};
