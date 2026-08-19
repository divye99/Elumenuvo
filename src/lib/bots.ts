/**
 * Shared bot/crawler detection for every beacon-style ingest route.
 * The merit engine, search learning and exploration logs must only ever
 * learn from humans (owner rule, Aug 2026): a crawler hitting 9,000 PDPs
 * would otherwise crown random products. UA patterns + the crawl-fleet IP
 * ranges that execute JS (Googlebot, Bing) and so reach client beacons.
 */
export const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|gtmetrix|preview|facebookexternalhit|whatsapp|telegram|slack|twitter|linkedin|discord|embedly|quora|python-requests|python-httpx|curl\/|wget|axios|node-fetch|go-http-client|vercel-screenshot|prerender|google-inspectiontool|googleother|google-read-aloud|google-pagespeed|apis-google|mediapartners|adsbot|feedfetcher|bingpreview|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|bytedance|yandex|applebot|amazonbot|claudebot|gptbot|oai-searchbot|perplexity|ccbot|cohere|anthropic|serpstat|dataforseo|zoominfo|barkrowler|seznam|baiduspider|sogou|360spider|coccoc|duckduckgo|qwant|neevabot|timpibot|awariobot|linkfluence|brandwatch|screaming.?frog|netcraft|expanse|censys|shodan|internetmeasurement|paloalto|masscan|zgrab/i;

export const BOT_IP_PREFIXES = ["66.249.", "157.55.39.", "207.46.13.", "40.77.167."];

export function isBotRequest(h: Headers): boolean {
  if (BOT_RE.test(h.get("user-agent") ?? "")) return true;
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return !!ip && BOT_IP_PREFIXES.some((p) => ip.startsWith(p));
}
