import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";
import { bouncerVerdict, BOUNCER_SERVES } from "@/lib/bots";
import { PASS_COOKIE, verifyPass } from "@/lib/bouncer-pass";

/** Next 16 "proxy" convention (formerly middleware). Two jobs:
 *
 *  1. The bouncer (owner rules, 21 Aug 2026): refuse DISGUISES, never a real
 *     person on an old device. Rules: src/lib/bots.ts bouncerVerdict. Known
 *     humans skip it entirely: anyone signed in (Supabase auth cookie) and
 *     anyone who pressed "I am a person" on the refusal page (signed pass
 *     cookie, src/lib/bouncer-pass.ts). A refused request gets a short page
 *     with that button, links that stay reachable, our phone and email; no
 *     render, no database, status 403. Refusals are logged (sampled) so a
 *     whole browser family being refused by mistake shows up in the logs
 *     instead of as a silent traffic drop.
 *     Why this exists: a residential-proxy fleet pulled 11,000+ product
 *     pages a day while running our JavaScript, which hit the database on
 *     every view until it stalled.
 *  2. Refreshes the Supabase auth session for the buyer app (/app) and the
 *     Elumenuvo (space) portal. */
const BLOCKED_HTML = (next: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>One quick check · Elume</title><style>body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#F6F7FB;color:#16215B;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}main{max-width:520px;background:#fff;border:1px solid #E8EBF1;border-radius:16px;padding:32px}h1{font-size:22px;margin:0 0 12px}p{line-height:1.6;margin:0 0 12px;color:#2c3550}a{color:#1D2F8A}button{background:#1D2F8A;color:#fff;border:0;border-radius:10px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer}form{margin:18px 0}</style></head><body><main><h1>One quick check before we open the page</h1><p>This request looks like automated traffic: it does not send the details every browser normally sends. Automated traffic was recently overloading the site, so we ask once.</p><form method="post" action="/api/bouncer-pass"><input type="hidden" name="next" value="${next}"><button type="submit">I am a person, open the page</button></form><p>Or reach us directly: <a href="/contact">contact page</a> · <a href="/request-product">request a product</a> · <a href="tel:+919818821175">+91 98188 21175</a> · <a href="mailto:info@elumenuvo.com">info@elumenuvo.com</a></p></main></body></html>`;

// Sampled refusal log: at most LOG_PER_MIN lines a minute per instance, so a
// wave does not turn into a log bill but a mistaken rule still shows up.
const LOG_PER_MIN = 20;
let logMinute = 0, logCount = 0;
function logBounce(kind: "refused" | "soft", verdict: string, request: NextRequest) {
  const m = Math.floor(Date.now() / 60_000);
  if (m !== logMinute) { logMinute = m; logCount = 0; }
  if (logCount++ >= LOG_PER_MIN) return;
  console.log(JSON.stringify({ bouncer: kind, verdict, path: request.nextUrl.pathname, ua: request.headers.get("user-agent"), ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(), country: request.headers.get("x-vercel-ip-country") }));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/app") || pathname.startsWith("/space/portal")) return await updateSession(request);

  // Known humans: signed in, or holding a valid pass.
  const signedIn = request.cookies.getAll().some((c) => /^sb-.*-auth-token/.test(c.name) && c.value.length > 100);
  if (signedIn || (await verifyPass(request.cookies.get(PASS_COOKIE)?.value))) return NextResponse.next();

  const verdict = bouncerVerdict(request.headers);
  if (BOUNCER_SERVES.has(verdict)) {
    if (verdict !== "ok") logBounce("soft", verdict, request);
    return NextResponse.next();
  }
  logBounce("refused", verdict, request);
  return new NextResponse(BLOCKED_HTML(encodeURIComponent(pathname + search)), {
    status: 403,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
      vary: "User-Agent, Sec-CH-UA, Sec-Fetch-Mode, Cookie",
      "x-elume-bouncer": verdict,
    },
  });
}

export const config = {
  matcher: [
    "/app", "/app/:path*", "/space/portal", "/space/portal/:path*",
    "/", "/catalogue/:path*", "/compare/:path*", "/brand/:path*", "/category/:path*",
    "/price-list/:path*", "/collections/:path*", "/for-you", "/search",
    "/api/personal/:path*", "/api/me/:path*", "/api/track", "/api/explore-log", "/api/search-log", "/api/suggest",
  ],
};
