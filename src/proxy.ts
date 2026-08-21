import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";
import { bouncerVerdict } from "@/lib/bots";

/** Next 16 "proxy" convention (formerly middleware). Two jobs:
 *
 *  1. The bouncer (owner rules, 21 Aug 2026): refuse DISGUISES, never a real
 *     person on an old device. The rules live in src/lib/bots.ts
 *     bouncerVerdict: headless toolkits, "Chromium" requests that send no
 *     client hints (a script wearing a Chrome user agent), and the Firefox
 *     116-124 band nobody really runs. Windows 7, UC Browser, KaiOS, old
 *     iPhones and every self-identified crawler or monitor pass. Refused
 *     requests get a short page (no render, no database), status 403.
 *     Why this exists: a residential-proxy fleet pulled 11,000+ product
 *     pages a day while running our JavaScript, which hit the database on
 *     every view until it stalled.
 *  2. Refreshes the Supabase auth session for the buyer app (/app) and the
 *     Elumenuvo (space) portal. */
const BLOCKED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>We could not verify your browser · Elume</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F6F7FB;color:#16215B;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:520px;background:#fff;border:1px solid #E8EBF1;border-radius:16px;padding:32px}h1{font-size:22px;margin:0 0 12px}p{line-height:1.6;margin:0 0 12px;color:#2c3550}a{color:#1D2F8A}</style></head><body><main><h1>We could not verify your browser</h1><p>This request looks like automated traffic: it claims to be a browser but does not send the details every real browser sends. Automated traffic was recently overloading the site, so such requests are not served.</p><p>If you are a person seeing this, a privacy tool or an unusual browser setup is hiding those details. Try another browser, or reach us directly and we will take your order by hand:</p><p><a href="tel:+919818821175">+91 98188 21175</a> · <a href="mailto:info@elumenuvo.com">info@elumenuvo.com</a></p></main></body></html>`;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/app") || pathname.startsWith("/space/portal")) return await updateSession(request);
  const verdict = bouncerVerdict(request.headers);
  if (verdict !== "ok") {
    return new NextResponse(BLOCKED_HTML, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-elume-bouncer": verdict },
    });
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
