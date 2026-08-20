import { adminClient } from "@/lib/supabase/admin";
import { BOT_RE, BOT_IP_PREFIXES, isStaleBrowser, FLEET_MIN_SESSIONS, FLEET_IP_MIN_SIDS } from "@/lib/bots";

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

// Only the columns the analytics page actually reads - site_events rows
// carry fat ua/detail payloads and select("*") was a large share of the
// page's load time.
const EVENT_COLS = "id, sid, type, path, detail, device, ip, ua, country, region, city, duration_ms, email, name, created_at";

/** Events for the last `hours`, NEWEST FIRST. The fetch is capped, and
 *  newest-first means a window that overflows the cap loses its OLDEST days,
 *  never today (the old ascending fetch silently dropped the current day
 *  once the window crossed 20k rows - "Thursday shows 2 visitors").
 *  Returned in ascending order for the aggregation code. */
export async function fetchEvents(hours: number, sid?: string): Promise<SiteEvent[]> {
  const db = adminClient();
  if (!db) return [];
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const out: SiteEvent[] = [];
  for (let from = 0; from < 30000; from += PAGE) {
    let q = db.from("site_events").select(EVENT_COLS).gte("created_at", since).order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    if (sid) q = q.eq("sid", sid);
    const { data, error } = await q;
    if (error || !data?.length) break;
    out.push(...(data as unknown as SiteEvent[]));
    if (data.length < PAGE) break;
  }
  return out.reverse();
}

/** Every session the 0124 classifier has flagged. Dropping these BEFORE the
 *  in-memory visitor build keeps the page fast and the numbers human. */
export async function fetchBotSids(): Promise<Set<string>> {
  const db = adminClient();
  if (!db) return new Set();
  const sids = new Set<string>();
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await db.from("bot_sessions").select("sid").range(from, from + PAGE - 1).then((r) => r, () => ({ data: null, error: true as const }));
    if (error || !data?.length) break;
    for (const r of data) sids.add(r.sid);
    if (data.length < PAGE) break;
  }
  return sids;
}

export type DailyTrafficRow = { day: string; visitors: number; pageviews: number; carts: number; identified: number };

/** Daily traffic aggregated IN the database (migration 0127): humans only,
 *  any window at constant cost. Falls back to null pre-migration. */
export async function fetchDailyTraffic(fromDay: string, toDay: string): Promise<DailyTrafficRow[] | null> {
  const db = adminClient();
  if (!db) return null;
  // Keep today bot-clean: classify the last two days before aggregating.
  try { await db.rpc("classify_bot_sessions", { from_day: fromDay > toDay ? toDay : new Date(new Date(toDay).getTime() - 86400000).toISOString().slice(0, 10), to_day: toDay }); } catch { /* pre-0124 */ }
  const { data, error } = await db.rpc("analytics_daily", { from_day: fromDay, to_day: toDay });
  if (error) return null;
  return (data ?? []).map((r: any) => ({ day: String(r.day), visitors: r.visitors ?? 0, pageviews: r.pageviews ?? 0, carts: r.carts ?? 0, identified: r.identified ?? 0 }));
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
  // Bot classification on OBJECTIVE machine evidence only. Deliberately NOT
  // evidence (owner rule): bouncing without interaction (a Google-listing
  // visitor who looks and leaves is a real view) and foreign geography
  // (foreign interest is real interest). Engagement always proves a human.
  //
  // Signals (any one fires; engaged sessions are never flagged):
  //   ua     - the full ingest bot list or looser agent fragments
  //   ip     - a known crawl-fleet range (Googlebot, Bing)
  //   stale  - a frozen browser version no auto-updating human still runs
  //            (the Aug 2026 proxy wave ships Chrome 118-121 / Firefox
  //            120-121 while every engaged session runs current builds),
  //            or a Windows 7 era UA
  //   fleet  - the same exact UA string across 8+ sessions in the window
  //            with not one of them ever engaging
  //   heavy  - 10+ pageviews yet zero taps, zero dwell, zero carts
  // Keep in lockstep with the SQL classifier in migration 0124.
  const engagedOf = (v: Visitor) => !!v.identity.email || v.addToCarts > 0 || (v.clicks > 0 && v.totalMs > 0);
  const uaGroups = new Map<string, { n: number; engaged: number }>();
  for (const v of all) {
    if (!v.ua) continue;
    const g = uaGroups.get(v.ua) ?? { n: 0, engaged: 0 };
    g.n += 1;
    if (engagedOf(v)) g.engaged += 1;
    uaGroups.set(v.ua, g);
  }
  const fleetUAs = new Set([...uaGroups.entries()].filter(([, g]) => g.n >= FLEET_MIN_SESSIONS && g.engaged === 0).map(([ua]) => ua));
  // Fleet-IP signal (0128): one exit IP minting 6+ device tokens with zero
  // clicks, zero carts and zero sign-ins across ALL of them is automation.
  // Quiet viewing alone never flags anyone; any single tap anywhere on the
  // IP clears the whole IP (so office NATs and campuses never trip it).
  const ipGroups = new Map<string, { n: number; clicks: number; carts: number; idents: number }>();
  for (const v of all) {
    if (!v.ip) continue;
    const g = ipGroups.get(v.ip) ?? { n: 0, clicks: 0, carts: 0, idents: 0 };
    g.n += 1;
    g.clicks += v.clicks;
    g.carts += v.addToCarts;
    if (v.identity.email) g.idents += 1;
    ipGroups.set(v.ip, g);
  }
  const fleetIPs = new Set([...ipGroups.entries()].filter(([, g]) => g.n >= FLEET_IP_MIN_SIDS && g.clicks === 0 && g.carts === 0 && g.idents === 0).map(([ip]) => ip));
  for (const v of all) {
    if (engagedOf(v)) { v.likelyBot = false; continue; }
    const uaBot = !!v.ua && (BOT_RE.test(v.ua) || LOOSE_AGENT_RE.test(v.ua));
    const ipBot = !!v.ip && BOT_IP_PREFIXES.some((p) => v.ip!.startsWith(p));
    const staleBot = isStaleBrowser(v.ua);
    const fleetBot = !!v.ua && fleetUAs.has(v.ua);
    const fleetIpBot = !!v.ip && fleetIPs.has(v.ip);
    const heavyCrawler = v.pageviews >= 10 && v.clicks === 0 && v.totalMs === 0 && v.addToCarts === 0;
    v.likelyBot = uaBot || ipBot || staleBot || fleetBot || fleetIpBot || heavyCrawler;
  }
  return all.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}
