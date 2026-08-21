// Bouncer corpus test: `node_modules/.bin/tsx scripts/test-bouncer.ts`
// Real devices common in India must pass; the 19 Aug 2026 fleet must not.
// Column 3: sends Chromium client hints (Sec-CH-UA). Column 4: sends Fetch
// Metadata (Sec-Fetch-Mode), which every real browser engine since 2021 does.
import { bouncerVerdict } from "../src/lib/bots";

const H = (ua: string, hints: boolean, meta: boolean) => ({
  get: (n: string) => {
    const k = n.toLowerCase();
    if (k === "user-agent") return ua;
    if (k === "sec-ch-ua") return hints ? '"Chromium";v="151", "Not A(Brand";v="8"' : null;
    if (k === "sec-fetch-mode") return hints || meta ? "navigate" : null;
    return null;
  },
});
const CASES: [string, string, boolean, boolean, string][] = [
  ["Chrome 151 desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", true, true, "ok"],
  ["Windows 7 + Chrome 109 (last for Win7)", "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36", true, true, "ok"],
  ["Windows 7 + Firefox 115 ESR", "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0", false, true, "ok"],
  ["current Firefox 153", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0", false, true, "ok"],
  ["Firefox Portable 120 (real, pinned)", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0", false, true, "stale-firefox-soft"],
  ["UC Browser 13 (Chrome 78)", "Mozilla/5.0 (Linux; U; Android 10; en-US; RMX2020 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/78.0.3904.108 UCBrowser/13.4.0.1306 Mobile Safari/537.36", false, true, "ok"],
  ["UC Browser 15 (U4 kernel, Chrome 100)", "Mozilla/5.0 (Linux; U; Android 13; en-US; SM-A155F Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 UCBrowser/15.5.8.1311 Mobile Safari/537.36", false, true, "ok"],
  ["HeyTap Browser (Oppo/Realme/OnePlus default)", "Mozilla/5.0 (Linux; U; Android 13; en-in; CPH2471 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 HeyTapBrowser/45.10.7.1 Mobile Safari/537.36", false, true, "ok"],
  ["Vivo Browser", "Mozilla/5.0 (Linux; U; Android 14; en-in; V2307 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 VivoBrowser/24.2.1.0 Mobile Safari/537.36", false, true, "ok"],
  ["Mi Browser", "Mozilla/5.0 (Linux; U; Android 13; en-in; 23076RA4BI Build/TKQ1.221114.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/112.0.5615.136 Mobile Safari/537.36 XiaoMi/MiuiBrowser/14.8.0-gn", false, true, "ok"],
  ["Huawei Browser", "Mozilla/5.0 (Linux; Android 12; HarmonyOS; NOH-NX9; HMSCore 6.12.0.302) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.88 HuaweiBrowser/14.0.2.311 Mobile Safari/537.36", false, true, "ok"],
  ["JioPages", "Mozilla/5.0 (Linux; Android 11; RMX2185 Build/RP1A.200720.011; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36 JioPages/3.0.1", false, true, "ok"],
  ["Quark", "Mozilla/5.0 (Linux; U; Android 12; zh-CN; M2012K11AC Build/SKQ1.211006.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/100.0.4896.58 Quark/6.2.2.246 Mobile Safari/537.36", false, true, "ok"],
  ["Amazon Silk (Fire tablet)", "Mozilla/5.0 (Linux; Android 9; KFTRWI) AppleWebKit/537.36 (KHTML, like Gecko) Silk/126.2.1 like Chrome/126.0.6478.71 Safari/537.36", false, true, "ok"],
  ["LG TV webOS", "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.5359.211 Safari/537.36 WebAppManager", false, true, "ok"],
  ["Qt desktop app", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.5.3 Chrome/112.0.5615.213 Safari/537.36", false, true, "ok"],
  ["JioPhone KaiOS (Firefox 48)", "Mozilla/5.0 (Mobile; LYF/F90M/LYF-F90M-000-03-15-180919; Android; rv:48.0) Gecko/48.0 Firefox/48.0 KAIOS/2.5", false, false, "ok"],
  ["Opera Mini", "Opera/9.80 (Android; Opera Mini/7.5.54678/28.2555; U; en) Presto/2.10.289 Version/12.02", false, false, "ok"],
  ["old iPhone iOS 15 Safari", "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1", false, true, "ok"],
  ["Chrome on iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1", false, true, "ok"],
  ["Samsung Internet", "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/130.0.0.0 Mobile Safari/537.36", true, true, "ok"],
  ["Android WebView (in-app)", "Mozilla/5.0 (Linux; Android 13; V2120 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36", false, true, "ok"],
  ["WebView with wv stripped by the app", "Mozilla/5.0 (Linux; Android 13; V2120 Build/TP1A.220624.014) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/140.0.0.0 Mobile Safari/537.36 PaytmApp", false, true, "ok"],
  ["Instagram in-app browser", "Mozilla/5.0 (Linux; Android 12; M2101K7BI Build/SKQ1.211006.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36 Instagram 340.0.0.22.100", false, true, "ok"],
  ["Edge desktop", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0", true, true, "ok"],
  ["Googlebot (evergreen Chrome, no hints)", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Chrome/151.0.0.0 Safari/537.36", false, false, "ok"],
  ["Bingbot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/151.0.0.0 Safari/537.36", false, false, "ok"],
  ["Applebot (Safari 13 token)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)", false, false, "ok"],
  ["ChatGPT-User", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot", false, false, "ok"],
  ["PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)", false, false, "ok"],
  ["WhatsApp link preview", "WhatsApp/2.23.20.0 A", false, false, "ok"],
  ["Facebook / Instagram link preview", "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", false, false, "ok"],
  ["Telegram link preview", "TelegramBot (like TwitterBot)", false, false, "ok"],
  ["LinkedIn link preview", "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)", false, false, "ok"],
  ["UptimeRobot", "Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)", false, false, "ok"],
  ["our own health monitor", "ElumeHealthMonitor/1.0 (+https://elumenuvo.com)", false, false, "ok"],
  ["Vercel deployment screenshot", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36 vercel-screenshot/1.0", false, true, "ok"],
  ["Google Lighthouse / PageSpeed", "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse", false, true, "ok"],
  ["fleet: Chrome 120 disguise, no hints", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", false, false, "spoofed-chromium"],
  ["fleet: Chrome 151 disguise, no hints", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", false, false, "spoofed-chromium"],
  ["fleet: Mac Chrome 119 disguise, no hints", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36", false, false, "spoofed-chromium"],
  ["headless Chromium wearing Chrome UA (Fetch Metadata, no hints)", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36", false, true, "spoofed-chromium"],
  ["fleet: Firefox 120 (script)", "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0", false, false, "stale-firefox"],
  ["fleet: Firefox 121 (script)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0", false, false, "stale-firefox"],
  ["fleet: Lightpanda", "Lightpanda/1.0", false, false, "headless"],
  ["HeadlessChrome, anonymous", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/151.0.0.0 Safari/537.36", true, true, "headless"],
  ["Puppeteer behind a Chrome UA that names itself", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Puppeteer", true, true, "headless"],
];
let fail = 0;
for (const [label, ua, hints, meta, want] of CASES) {
  const got = bouncerVerdict(H(ua, hints, meta));
  const ok = got === want; if (!ok) fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(62)} -> ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(fail ? `${fail} failure(s)` : `all ${CASES.length} cases pass`);
process.exit(fail ? 1 : 0);
