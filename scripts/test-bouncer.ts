// Bouncer corpus test: `node_modules/.bin/tsx scripts/test-bouncer.ts`
// Real devices common in India must pass; the 19 Aug 2026 fleet must not.
import { bouncerVerdict } from "../src/lib/bots";

const H = (ua: string, hints: boolean) => ({ get: (n: string) => (n.toLowerCase() === "user-agent" ? ua : n.toLowerCase() === "sec-ch-ua" && hints ? '"Chromium";v="151", "Not A(Brand";v="8"' : null) });
const CASES: [string, string, boolean, string][] = [
  ["Chrome 151 desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", true, "ok"],
  ["Windows 7 + Chrome 109 (last for Win7)", "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36", true, "ok"],
  ["Windows 7 + Firefox 115 ESR", "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0", false, "ok"],
  ["UC Browser (reports Chrome 78)", "Mozilla/5.0 (Linux; U; Android 10; en-US; RMX2020 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.108 UCBrowser/13.4.0.1306 Mobile Safari/537.36", false, "ok"],
  ["JioPhone KaiOS (Firefox 48)", "Mozilla/5.0 (Mobile; LYF/F90M/LYF-F90M-000-03-15-180919; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5", false, "ok"],
  ["Opera Mini", "Opera/9.80 (Android; Opera Mini/7.5.54678/28.2555; U; en) Presto/2.10.289 Version/12.02", false, "ok"],
  ["old iPhone iOS 15 Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1", false, "ok"],
  ["Chrome on iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1", false, "ok"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/130.0.0.0 Mobile Safari/537.36", true, "ok"],
  ["Android WebView (in-app)", "Mozilla/5.0 (Linux; Android 13; V2120 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36", false, "ok"],
  ["Instagram in-app browser", "Mozilla/5.0 (Linux; Android 12; M2101K7BI Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.22.100", false, "ok"],
  ["Edge desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0", true, "ok"],
  ["Googlebot (evergreen Chrome, no hints)", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/151.0.0.0 Safari/537.36", false, "ok"],
  ["Bingbot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/151.0.0.0 Safari/537.36", false, "ok"],
  ["Applebot (Safari 13 token)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)", false, "ok"],
  ["ChatGPT-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", false, "ok"],
  ["PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", false, "ok"],
  ["WhatsApp link preview", "WhatsApp/2.23.20.0 A", false, "ok"],
  ["UptimeRobot", "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)", false, "ok"],
  ["our own health monitor", "ElumeHealthMonitor/1.0 (+https://elumenuvo.com)", false, "ok"],
  ["fleet: Chrome 120 disguise, no hints", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", false, "spoofed-chromium"],
  ["fleet: Chrome 151 disguise, no hints", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", false, "spoofed-chromium"],
  ["fleet: Mac Chrome 119 disguise, no hints", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36", false, "spoofed-chromium"],
  ["fleet: Firefox 120", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0", false, "stale-firefox"],
  ["fleet: Firefox 121", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0", false, "stale-firefox"],
  ["fleet: Lightpanda", "Lightpanda/1.0", false, "headless"],
  ["HeadlessChrome, anonymous", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36", true, "headless"],
  ["Vercel deployment screenshot", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36 vercel-screenshot/1.0", false, "ok"],
  ["Google Lighthouse / PageSpeed", "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse", false, "ok"],
  ["Facebook / Instagram link preview", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", false, "ok"],
  ["Telegram link preview", "TelegramBot (like TwitterBot)", false, "ok"],
  ["LinkedIn link preview", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)", false, "ok"],
  ["Puppeteer behind a Chrome UA that names itself", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Puppeteer", true, "headless"],
  ["current Firefox 153", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0", false, "ok"],
];
let fail = 0;
for (const [label, ua, hints, want] of CASES) {
  const got = bouncerVerdict(H(ua, hints));
  const ok = got === want; if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(42)} -> ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(fail ? `${fail} failure(s)` : `all ${CASES.length} cases pass`);
process.exit(fail ? 1 : 0);
