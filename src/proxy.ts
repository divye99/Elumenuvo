import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";
import { isStaleBrowser } from "@/lib/bots";

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/app") || pathname.startsWith("/space/portal")) return await updateSession(request);
  const ua = request.headers.get("user-agent");
  if (HEADLESS_RE.test(ua ?? "") || isStaleBrowser(ua)) {
    return new NextResponse("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/app", "/app/:path*", "/space/portal", "/space/portal/:path*",
    "/", "/catalogue/:path*", "/compare/:path*", "/brand/:path*", "/category/:path*",
    "/price-list/:path*", "/collections/:path*", "/for-you", "/search",
    "/api/personal/:path*", "/api/track", "/api/explore-log", "/api/search-log", "/api/suggest",
  ],
};
