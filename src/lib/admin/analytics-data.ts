import { adminClient } from "@/lib/supabase/admin";

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
  ip: string | null;
  firstSeen: string;
  lastSeen: string;
  pageviews: number;
  clicks: number;
  addToCarts: number;
  totalMs: number;
  landingReferrer: string | null;
  utm: string | null;
};

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

export type JourneyItem = { at: string; icon: string; title: string; sub?: string };

const ICON: Record<string, string> = { pageview: "📄", leave: "⏱", click: "👆", product_click: "🛍", add_to_cart: "🛒", identify: "🪪", search: "🔎", legacy: "🗂" };
const durTxt = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

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
      v = { sid: e.sid, identity: { email: null, name: null }, device: null, location: null, ip: null, firstSeen: e.created_at, lastSeen: e.created_at, pageviews: 0, clicks: 0, addToCarts: 0, totalMs: 0, landingReferrer: null, utm: null };
      by.set(e.sid, v);
    }
    v.lastSeen = e.created_at;
    if (e.device) v.device = e.device;
    if (e.city || e.country) v.location = [e.city, e.region, e.country].filter(Boolean).join(", ");
    if (e.ip) v.ip = e.ip;
    if (e.type === "pageview") {
      v.pageviews++;
      const d = e.detail as Record<string, string> | null;
      if (d?.referrer_landing && !v.landingReferrer) v.landingReferrer = d.referrer_landing;
      const utm = d && ["utm_source", "utm_medium", "utm_campaign"].map((k) => d[k]).filter(Boolean).join(" / ");
      if (utm && !v.utm) v.utm = utm;
    }
    if (e.type === "click" || e.type === "product_click") v.clicks++;
    if (e.type === "add_to_cart") v.addToCarts++;
    if (e.type === "leave" && e.duration_ms) v.totalMs += e.duration_ms;
    if (e.type === "identify") {
      if (e.email) v.identity.email = e.email;
      if (e.name) v.identity.name = e.name;
    }
  }
  return [...by.values()].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
}
