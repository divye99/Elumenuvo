import { adminClient } from "@/lib/supabase/admin";
import { BOT_RE, BOT_IP_PREFIXES } from "@/lib/bots";

/** Server-side reads for the admin Analytics pages (service role only). */

export type SiteEvent = {
  id: number; sid: string; type: string; path: string | null;
  detail: Record<string, unknown> | null; referrer: string | null; device: string | null;
  ip: string | null; country: string | null; region: string | null; city: string | null;
  duration_ms: number | null; email: string | null; name: string | null; created_at: string;
};

export type Visitor = {
  sid: string;
  identity: { email: string | null; name: string | null };
  device: string | null;
  location: string | null;
  country: string | null;
  region: string | null;
  ip: string | null;
  ua: string | null;
  likelyBot: boolean;
  firstSeen: string;
  lastSeen: string;
  pageviews: number;
  clicks: number;
  addToCarts: number;
  totalMs: number;
  landingReferrer: string | null;
  utm: string | null;
  /** UTM parts kept separately so traffic can be told apart precisely:
   *  order emails land as email/email/order-*, cold outreach as
   *  email/outreach/trade100-*, and utmContent names the exact company. */
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
};

/** Display-layer bot classification reuses the full ingest gate list
 *  (src/lib/bots.ts) so both layers agree, plus a few looser fragments that
 *  are safe here but too broad for ingest (a UA merely CONTAINING "python"
 *  is fine to hide from a report, riskier to silently drop at the door).
 *  Catches rows recorded before a pattern was added to the ingest gate. */
const LOOSE_AGENT_RE = /python|curl|go-http|java\/|okhttp|libwww|scrapy|phantomjs|selenium|puppeteer|playwright/i;

const PAGE = 1000;

export async function fetchEvents(days: number, sid?: string): Promise<SiteEvent[]> {
  const db = adminClient();
  if (!db) return [];
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const out: SiteEvent[] = [];
  for (let from = 0; from < 20000; from += PAGE) {
    let q = db.from("site_events").select("*").gte("created_at", since).order("created_at", { ascending: true }).range(from, from + PAGE - 1);
    if (sid) q = q.eq("sid", sid);
    const { data, error } = await q;
    if (error || !data?.length) break;
    out.push(...(data as SiteEvent[]));
    if (data.length < PAGE) break;
  }
  return out;
}

export async function fetchAllSearches(days: number): Promise<Map<string, SearchRow[]>> {
  const db = adminClient();
  if (!db) return new Map();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data } = await db
    .from("search_queries")
    .select("session_id, query, source, results, picked, created_at")
    .gte("created_at", since)
    .not("session_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(5000);
  const by = new Map<string, SearchRow[]>();
  for (const r of (data ?? []) as (SearchRow & { session_id: string })[]) {
    (by.get(r.session_id) ?? by.set(r.session_id, []).get(r.session_id)!).push(r);
  }
  return by;
}

export type SearchRow = { query: string; source: string; results: number | null; picked: string | null; created_at: string };

export type SurveyRow = { company: string; phone: string; created_at: string };

/** Trade-survey responses, for cross-referencing against the outreach roster.
 *  Tolerates the table being absent (pre-migration) by returning nothing. */
export async function fetchSurveyResponses(): Promise<SurveyRow[]> {
  const db = adminClient();
  if (!db) return [];
  const { data } = await db
    .from("trade_survey")
    .select("company, phone, created_at")
    .order("created_at", { ascending: false })
    .limit(1000)
    .then((r) => r, () => ({ data: [] as SurveyRow[] }));
  return (data ?? []) as SurveyRow[];
}

/** Loose key for matching a typed company name against the roster: a firm may
 *  write "Bhutani Infra Pvt Ltd" where the roster says "Bhutani Infra". */
export function companyKey(name: string): string {
  return name.toLowerCase().replace(/\b(pvt|private|ltd|limited|llp|inc|co|company|and|the)\b/g, "").replace(/[^a-z0-9]/g, "");
}

export type JourneyItem = { at: string; icon: string; title: string; sub?: string };

const ICON: Record<string, string> = { pageview: "📄", leave: "⏱", click: "👆", product_click: "🛍", add_to_cart: "🛒", identify: "🪪", search: "🔎", legacy: "🗂", input: "⌨️" };
const durTxt = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

/** Rows recorded before fields had names show placeholder examples; map the
 *  known ones to what they actually are. */
const LEGACY_FIELD_LABELS: Record<string, string> = {
  "+91 98765 43210": "phone",
  "110001": "PIN code",
  "text": "field",
  "Flat / house no., building": "address line 1",
  "Street, area, locality": "address line 2",
  "Landmark (optional)": "landmark",
  "you@email.com": "email",
};
function prettyFieldLabel(label: unknown): string {
  const l = String(label ?? "field");
  return LEGACY_FIELD_LABELS[l] ?? l;
}

/** One visitor's ordered timeline from their events + searches. */
export function buildJourney(events: SiteEvent[], searches: SearchRow[]): JourneyItem[] {
  const items: JourneyItem[] = [];
  for (const e of events) {
    const d = (e.detail ?? {}) as Record<string, string>;
    if (e.type === "pageview") items.push({ at: e.created_at, icon: ICON.pageview, title: e.path ?? "/", sub: d.referrer_landing ? `arrived from ${d.referrer_landing}` : undefined });
    else if (e.type === "leave") items.push({ at: e.created_at, icon: ICON.leave, title: `spent ${durTxt(e.duration_ms ?? 0)} on ${e.path ?? "page"}` });
    else if (e.type === "product_click") items.push({ at: e.created_at, icon: ICON.product_click, title: `tapped product: ${d.label || d.product_id}`, sub: d.product_id });
    else if (e.type === "add_to_cart") items.push({ at: e.created_at, icon: ICON.add_to_cart, title: `added to cart (${d.label ?? ""})` });
    else if (e.type === "identify") items.push({ at: e.created_at, icon: ICON.identify, title: `identified as ${e.name || e.email}`, sub: e.email ?? undefined });
    else if (e.type === "legacy") items.push({ at: e.created_at, icon: ICON.legacy, title: d.label ?? "recorded action", sub: "from records predating analytics" });
    else if (e.type === "input") items.push({ at: e.created_at, icon: ICON.input, title: `typed “${d.value}”`, sub: `${prettyFieldLabel(d.label)} · ${e.path ?? d.path ?? ""}` });
    // PDP telemetry: section-visibility pings are aggregate fuel for the
    // Product-page tab, not journey material - a single scroll would add 12
    // rows of noise. Photo interactions ARE deliberate acts, so they show.
    else if (e.type === "pdp_section") continue;
    else if (e.type === "pdp_image") {
      const act = { open: "opened the photo viewer", thumb: "flipped through photos", arrow: "flipped through photos", zoom: "zoomed into a photo", hover: "magnified a photo" }[d.act ?? ""] ?? "looked at photos";
      items.push({ at: e.created_at, icon: "🖼️", title: act, sub: e.path ?? undefined });
    }
    else items.push({ at: e.created_at, icon: ICON.click, title: `tapped "${d.label ?? "?"}"`, sub: d.href });
  }
  for (const s of searches) {
    items.push({ at: s.created_at, icon: ICON.search, title: s.source === "suggest" ? `picked suggestion "${s.picked}" after typing "${s.query}"` : `searched "${s.query}" (${s.results ?? "?"} results)` });
  }
  items.sort((a, b) => (a.at < b.at ? -1 : 1));
  return items;
}

/** Group an event stream into visitor summaries, newest activity first.
 *  Identity correlation: any identify event on the sid names the WHOLE
 *  history, past and future, since the key never changes. */
export function toVisitors(events: SiteEvent[]): Visitor[] {
  const by = new Map<string, Visitor>();
  for (const e of events) {
    let v = by.get(e.sid);
    if (!v) {
      v = { sid: e.sid, identity: { email: null, name: null }, device: null, location: null, country: null, region: null, ip: null, ua: null, likelyBot: false, firstSeen: e.created_at, lastSeen: e.created_at, pageviews: 0, clicks: 0, addToCarts: 0, totalMs: 0, landingReferrer: null, utm: null, utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null };
      by.set(e.sid, v);
    }
    v.lastSeen = e.created_at;
    if (e.device) v.device = e.device;
    if (e.city || e.country) v.location = [e.city, e.region, e.country].filter(Boolean).join(", ");
    if (e.country) v.country = e.country;
    if (e.region) v.region = e.region;
    if ((e as any).ua && !v.ua) v.ua = (e as any).ua;
    if (e.ip) v.ip = e.ip;
    if (e.type === "pageview") {
      v.pageviews++;
      const d = e.detail as Record<string, string> | null;
      if (d?.referrer_landing && !v.landingReferrer) v.landingReferrer = d.referrer_landing;
      const utm = d && ["utm_source", "utm_medium", "utm_campaign"].map((k) => d[k]).filter(Boolean).join(" / ");
      if (utm && !v.utm) v.utm = utm;
      // First touch wins: the campaign that actually brought them in stays
      // the attribution even if they later arrive again by another route.
      if (d?.utm_source && !v.utmSource) v.utmSource = d.utm_source;
      if (d?.utm_medium && !v.utmMedium) v.utmMedium = d.utm_medium;
      if (d?.utm_campaign && !v.utmCampaign) v.utmCampaign = d.utm_campaign;
      if (d?.utm_content && !v.utmContent) v.utmContent = d.utm_content;
    }
    if (e.type === "click" || e.type === "product_click") v.clicks++;
    if (e.type === "add_to_cart") v.addToCarts++;
    if (e.type === "leave" && e.duration_ms) v.totalMs += e.duration_ms;
    if (e.type === "identify") {
      if (e.email) v.identity.email = e.email;
      if (e.name) v.identity.name = e.name;
    }
  }
  const all = [...by.values()];
  for (const v of all) {
    // Bot when ANY of four signals fires:
    //   ua        - matches the full ingest bot list or the looser fragments
    //   ip        - from a known crawl-fleet range (Googlebot, Bing)
    //   light     - outside India, barely any events, no interaction, zero
    //               dwell (drive-by crawler). Indian light sessions are never
    //               flagged this way: a real buyer checking one price looks
    //               identical.
    //   heavy     - ANY country: 10+ pageviews yet zero clicks, zero dwell,
    //               zero carts, never identified. No human reads ten pages
    //               without producing a single leave-timer or tap; this is
    //               the disguised-UA crawler that was polluting the numbers
    //               (owner report, Aug 2026).
    const uaBot = !!v.ua && (BOT_RE.test(v.ua) || LOOSE_AGENT_RE.test(v.ua));
    const ipBot = !!v.ip && BOT_IP_PREFIXES.some((p) => v.ip!.startsWith(p));
    const lightCrawler = v.country !== "IN" && v.pageviews <= 2 && v.clicks === 0 && v.addToCarts === 0 && v.totalMs === 0 && !v.identity.email;
    const heavyCrawler = v.pageviews >= 10 && v.clicks === 0 && v.totalMs === 0 && v.addToCarts === 0 && !v.identity.email;
    v.likelyBot = uaBot || ipBot || lightCrawler || heavyCrawler;
  }
  return all.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}
