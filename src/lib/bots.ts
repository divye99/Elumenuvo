/**
 * Shared bot/crawler detection for every beacon-style ingest route.
 * The merit engine, search learning and exploration logs must only ever
 * learn from humans (owner rule, Aug 2026): a crawler hitting 9,000 PDPs
 * would otherwise crown random products. UA patterns + the crawl-fleet IP
 * ranges that execute JS (Googlebot, Bing) and so reach client beacons.
 */
export const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|gtmetrix|preview|facebookexternalhit|whatsapp|telegram|slack|twitter|linkedin|discord|embedly|quora|python-requests|python-httpx|curl\/|wget|axios|node-fetch|go-http-client|vercel-screenshot|prerender|google-inspectiontool|googleother|google-read-aloud|google-pagespeed|apis-google|mediapartners|adsbot|feedfetcher|bingpreview|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|bytedance|yandex|applebot|amazonbot|claudebot|gptbot|oai-searchbot|perplexity|ccbot|cohere|anthropic|serpstat|dataforseo|zoominfo|barkrowler|seznam|baiduspider|sogou|360spider|coccoc|duckduckgo|qwant|neevabot|timpibot|awariobot|linkfluence|brandwatch|screaming.?frog|netcraft|expanse|censys|shodan|internetmeasurement|paloalto|masscan|zgrab|lightpanda|scrapy|phantomjs/i;

export const BOT_IP_PREFIXES = ["66.249.", "157.55.39.", "207.46.13.", "40.77.167."];

export function isBotRequest(h: Headers): boolean {
  if (BOT_RE.test(h.get("user-agent") ?? "")) return true;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return !!ip && BOT_IP_PREFIXES.some((p) => ip.startsWith(p));
}

/* ── Session-level bot evidence (display layer + rollup classifier) ──
 *
 * The Aug 2026 residential-proxy crawl wave defeats simple rules: spoofed
 * desktop UAs, foreign residential IPs, executes JS, even fires leave-timers
 * (fake dwell). Two things it cannot fake:
 *   1. Browser freshness. Real browsers auto-update; bot toolkits ship
 *      frozen UA strings. The wave runs Chrome 118-121 / Firefox 120-121
 *      (late 2023) while every engaged human session runs current versions.
 *   2. UA diversity. The wave reuses ~11 exact UA strings across hundreds
 *      of sessions, none of which ever engages (the fleet signature).
 *
 * Deliberately NOT evidence (owner rule): bouncing without interaction (a
 * Google-listing visitor who looks and leaves is a real view) and foreign
 * geography (foreign interest is real interest). Engagement always proves a
 * human; its absence proves nothing by itself.
 *
 * STALE_BROWSER_MAX must move forward roughly yearly (current-major minus
 * ~25). Keep in lockstep with the SQL classifier in migration 0124. */

export const STALE_BROWSER_MAX: Record<string, number> = {
  chrome: 125,  // Aug 2026: current ~151; also covers Edge/Opera via their Chrome/ token
  firefox: 125, // current ~153
  safari: 16,
  ios: 16,
};

export function browserVersion(ua: string | null | undefined): { fam: keyof typeof STALE_BROWSER_MAX | "other"; v: number } {
  if (!ua) return { fam: "other", v: -1 };
  let m = ua.match(/Chrome\/(\d+)/);
  if (m) return { fam: "chrome", v: +m[1] };
  m = ua.match(/Firefox\/(\d+)/) ?? ua.match(/rv:(\d+)/);
  if (m) return { fam: "firefox", v: +m[1] };
  if (/iPhone|iPad/.test(ua)) {
    m = ua.match(/OS (\d+)_/);
    if (m) return { fam: "ios", v: +m[1] };
  }
  m = ua.match(/Version\/(\d+)[.\d]* .*Safari/);
  if (m) return { fam: "safari", v: +m[1] };
  return { fam: "other", v: -1 };
}

/** Frozen bot-toolkit UA: a browser version no auto-updating human still
 *  runs, or a Windows 7/8 UA (NT 6.x, long out of support). */
export function isStaleBrowser(ua: string | null | undefined): boolean {
  if (!ua) return false;
  if (/Windows NT 6\./.test(ua)) return true;
  const { fam, v } = browserVersion(ua);
  return fam !== "other" && v > 0 && v < STALE_BROWSER_MAX[fam];
}

/** Minimum sessions sharing one exact UA string, with zero of them engaged,
 *  before the whole group reads as a crawl fleet. */
export const FLEET_MIN_SESSIONS = 8;

/** Minimum distinct sessions from one IP before the fleet-ip signal can
 *  even be considered. It then fires ONLY when the IP also shows zero
 *  clicks, zero carts and zero sign-ins across ALL its sessions: quiet
 *  viewing alone never flags anyone (owner rule), and any single tap
 *  anywhere on the IP clears the whole IP. Lockstep with migration 0128. */
export const FLEET_IP_MIN_SIDS = 6;

/* ── Edge bouncer (src/proxy.ts), owner rules 21 Aug 2026 ──
   Block DISGUISES, never a real person on an old device. India has plenty of
   Windows 7 PCs (Chrome stops at 109 there), UC Browser (reports Chrome 78),
   JioPhones on KaiOS (Firefox 48) and old iPhones; all of them must get in.
   What is refused:
   - a headless toolkit that says so (Lightpanda, HeadlessChrome, Puppeteer,
     Playwright, PhantomJS);
   - a request CLAIMING to be Chromium 89 or newer without the Sec-CH-UA
     client-hint header. Every real Chromium 89+ (Chrome, Edge, Opera, Brave,
     Samsung Internet, Vivaldi, Yandex) sends it on HTTPS automatically; the
     scraper fleet of 19 Aug typed "Chrome/120" into a script that sends no
     hints at all. In-app browsers and WebViews are exempt because some apps
     rewrite the UA and hint behaviour varies;
   - a request claiming Firefox 116 to 124, a version band that no real
     browser sits in: 115 ESR is the last Firefox for Windows 7 and stays
     allowed, 125+ is a current auto-updating Firefox, 116 to 124 were only
     ever six-week releases from 2023-24 that auto-updated themselves away.
     The 19 Aug fleet used Firefox 120 and 121.
   Self-identified crawlers, monitors and link previewers (BOT_RE) are always
   let through; robots.txt governs them, not the bouncer. */
export const HEADLESS_RE = /lightpanda|headlesschrome|phantomjs|puppeteer|playwright/i;
const IN_APP_RE = /\bwv\b|FBAN|FBAV|FB_IAB|Instagram|Snapchat|Line\/|MicroMessenger|GSA\/|DuckDuckGo\/|Electron\//i;
export type BouncerVerdict = "ok" | "headless" | "spoofed-chromium" | "stale-firefox";

export function bouncerVerdict(h: { get(name: string): string | null }): BouncerVerdict {
  const ua = h.get("user-agent") ?? "";
  if (HEADLESS_RE.test(ua)) return "headless";
  if (BOT_RE.test(ua)) return "ok";
  const chrome = ua.match(/\b(?:Chrome|Chromium)\/(\d+)/);
  if (chrome && Number(chrome[1]) >= 89 && !IN_APP_RE.test(ua) && !h.get("sec-ch-ua")) return "spoofed-chromium";
  const ff = ua.match(/\bFirefox\/(\d+)/);
  if (ff) {
    const v = Number(ff[1]);
    if (v >= 116 && v <= 124) return "stale-firefox";
  }
  return "ok";
}
