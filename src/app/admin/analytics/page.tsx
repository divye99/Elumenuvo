import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchEvents, fetchBotSids, fetchDailyTraffic, fetchAllSearches, toVisitors, buildJourney, type SiteEvent } from "@/lib/admin/analytics-data";
import { fetchProductsLite } from "@/lib/products";
import SearchPanel from "./SearchPanel";
import { fetchSearchAnalytics } from "@/lib/admin/search-analytics";
import { istDateTime, istDate, istTime, istDayKey, istWeekday, shiftDayKey } from "@/lib/admin/ist";
import Filters from "./Filters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

/** Referrer hostname, tolerant of the malformed values that occasionally land
 *  in the column - a bad URL here must not take the whole page down. */
const hostOf = (url: string | null): string => {
  if (!url) return "";
  try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
};

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ days?: string; identity?: string; device?: string; country?: string; state?: string; src?: string; min?: string; bots?: string; brand?: string; view?: string }> }) {
  await requireAdmin();
  const { days: d, identity, device, country, state, src, min, bots, brand, view } = await searchParams;
  // days=1 is the rolling LAST 24 HOURS view; everything else is IST days.
  const days = Math.min(90, Math.max(1, Number(d) || 7));
  const is24h = days === 1;
  const isTraffic = view === "traffic";
  const isSearch = view === "search";
  const showingBots = bots === "1" || bots === "only";

  // Daily traffic is aggregated IN the database (migration 0127): the 90-day
  // view costs the same as the 7-day one, and today can never fall off a
  // fetch cap again. Raw events are only pulled for the window actually
  // shown (plus the comparison week on the 24h traffic view).
  const daily = isTraffic && !is24h
    ? await fetchDailyTraffic(shiftDayKey(istDayKey(new Date()), -(days + 6)), istDayKey(new Date()))
    : null;
  const needEvents = !isTraffic || is24h || daily === null;
  const hours = is24h ? (isTraffic ? 48 : 24) : days * 24; // 24h traffic compares with the previous 24h
  const [events, knownBotSids, searchesBySid, productsLite] = await Promise.all([
    needEvents ? fetchEvents(isTraffic && daily === null ? Math.min(97, days + 7) * 24 : hours) : Promise.resolve([]),
    fetchBotSids(),
    fetchAllSearches(days),
    fetchProductsLite(),
  ]);
  // Sessions the 0124 classifier already flagged are dropped before any
  // in-memory work - unless bots were explicitly requested.
  const prefiltered = showingBots ? events : events.filter((e) => !knownBotSids.has(e.sid));
  const allVisitors = toVisitors(prefiltered);
  const botSids = new Set([...knownBotSids, ...allVisitors.filter((v) => v.likelyBot).map((v) => v.sid)]);

  // Brand filter: path -> product -> brand, from the cached catalogue fetch.
  const productByPath = new Map(productsLite.map((p) => [`/catalogue/${p.id}`, p]));
  const brands = [...new Set(productsLite.map((p) => p.brand))].sort();
  const brandSidSet = brand
    ? new Set(prefiltered.filter((e) => e.type === "pageview" && productByPath.get((e.path ?? "").split("?")[0])?.brand === brand).map((e) => e.sid))
    : null;
  // Search analytics runs after visitor classification (not in the batch
  // above) because it needs the bot session set: historic crawler rows
  // predate the ingest gate and must not shape the query cloud or the
  // missed-demand list.
  const searchStats = isSearch ? await fetchSearchAnalytics(days, botSids) : null;

  // Dropdown options come from the data itself (humans only, unless bots are
  // explicitly shown - a country only crawlers come from is not a filter
  // anyone needs). India leads the country list.
  const optionBase = showingBots ? allVisitors : allVisitors.filter((v) => !v.likelyBot);
  const countries = [...new Set(optionBase.map((v) => v.country).filter(Boolean) as string[])]
    .sort((a, b) => (a === "IN" ? -1 : b === "IN" ? 1 : a.localeCompare(b)));
  const states = [...new Set(optionBase.filter((v) => !country || v.country === country).map((v) => v.region).filter(Boolean) as string[])].sort();
  const deviceOSes = [...new Set(optionBase.map((v) => v.device?.split(" · ")[0]).filter(Boolean) as string[])].sort();

  const visitors = allVisitors.filter((v) => {
    // Likely bots are hidden unless explicitly requested.
    if (bots === "only") { if (!v.likelyBot) return false; }
    else if (bots !== "1" && v.likelyBot) return false;
    if (identity === "identified" && !v.identity.email) return false;
    if (identity === "anonymous" && v.identity.email) return false;
    if (device && !(v.device ?? "").startsWith(device)) return false;
    if (country && v.country !== country) return false;
    if (state && v.region !== state) return false;
    if (src) {
      const ref = (v.landingReferrer ?? "").toLowerCase();
      if (src === "google" && !ref.includes("google")) return false;
      if (src === "email" && v.utmSource !== "email") return false;
      if (src === "campaign" && (!v.utm || v.utmSource === "email")) return false;
      if (src === "referral" && (!ref || ref.includes("google") || v.utm)) return false;
      if (src === "direct" && (ref || v.utm)) return false;
    }
    if (min === "cart" && !v.addToCarts) return false;
    if (min && min !== "cart" && v.pageviews < Number(min)) return false;
    if (brandSidSet && !brandSidSet.has(v.sid)) return false;
    return true;
  });
  const identified = visitors.filter((v) => v.identity.email).length;

  // Top PRODUCT pages (owner, Aug 2026: the pages that matter are PDPs):
  // pageview counts across the filtered sessions, restricted to catalogue
  // product paths and resolved to product name + brand.
  const keptSids = new Set(visitors.map((v) => v.sid));
  const pageAgg = new Map<string, { views: number; sids: Set<string>; ms: number }>();
  for (const e of events) {
    if (!keptSids.has(e.sid)) continue;
    const path = (e.path ?? "/").split("?")[0];
    const prod = productByPath.get(path);
    if (!prod) continue;
    if (brand && prod.brand !== brand) continue;
    if (e.type === "pageview") {
      const a = pageAgg.get(path) ?? { views: 0, sids: new Set<string>(), ms: 0 };
      a.views += 1; a.sids.add(e.sid);
      pageAgg.set(path, a);
    } else if (e.type === "leave" && e.duration_ms) {
      const a = pageAgg.get(path) ?? { views: 0, sids: new Set<string>(), ms: 0 };
      a.ms += e.duration_ms;
      pageAgg.set(path, a);
    }
  }

  // ── Traffic rows ──
  // Daily windows come pre-aggregated from the database (humans only, whole
  // site: the dropdown filters do not apply here). The 24h view buckets the
  // last day's events per hour, compared with the same hour yesterday.
  const todayKey = istDayKey(new Date());
  type TrafficRow = { key: string; prevKey: string; weekday: string; visitors: number; views: number; carts: number; identified: number; prevVisitors: number; delta: number | null; pct: number | null };
  let trafficRows: TrafficRow[] = [];
  if (isTraffic && is24h) {
    const hourAgg = new Map<number, { sids: Set<string>; views: number; carts: Set<string> }>();
    const now = Date.now();
    for (const e of events) {
      if (botSids.has(e.sid) && !showingBots) continue;
      const age = now - new Date(e.created_at).getTime();
      const hoursAgo = Math.floor(age / 3600_000); // 0..47
      if (e.type !== "pageview" && e.type !== "add_to_cart") continue;
      const a = hourAgg.get(hoursAgo) ?? { sids: new Set<string>(), views: 0, carts: new Set<string>() };
      if (e.type === "pageview") { a.sids.add(e.sid); a.views += 1; } else a.carts.add(e.sid);
      hourAgg.set(hoursAgo, a);
    }
    trafficRows = Array.from({ length: 24 }, (_, i) => {
      const cur = hourAgg.get(i);
      const prev = hourAgg.get(i + 24);
      const label = new Date(now - i * 3600_000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: true });
      const visitorsNow = cur?.sids.size ?? 0;
      const visitorsPrev = prev?.sids.size ?? 0;
      return {
        key: label, prevKey: "same hour yesterday", weekday: i === 0 ? "now" : `-${i}h`,
        visitors: visitorsNow, views: cur?.views ?? 0, carts: cur?.carts.size ?? 0, identified: 0,
        prevVisitors: visitorsPrev, delta: visitorsNow - visitorsPrev,
        pct: visitorsPrev > 0 ? Math.round(((visitorsNow - visitorsPrev) / visitorsPrev) * 100) : null,
      };
    });
  } else if (isTraffic) {
    // Pre-0127 fallback: aggregate the (newest-first, capped) events fetch in
    // JS. Once the migration runs, `daily` is set and this branch is skipped.
    const fallback: typeof daily = daily ?? (() => {
      const agg = new Map<string, { sids: Set<string>; views: number; carts: Set<string>; idents: Set<string> }>();
      for (const e of events) {
        if (botSids.has(e.sid)) continue;
        const k = istDayKey(e.created_at);
        let a = agg.get(k);
        if (!a) { a = { sids: new Set(), views: 0, carts: new Set(), idents: new Set() }; agg.set(k, a); }
        if (e.type === "pageview") { a.sids.add(e.sid); a.views += 1; }
        else if (e.type === "add_to_cart") a.carts.add(e.sid);
        else if (e.type === "identify") a.idents.add(e.sid);
      }
      return [...agg.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))
        .map(([day, a]) => ({ day, visitors: a.sids.size, pageviews: a.views, carts: a.carts.size, identified: a.idents.size }));
    })();
    const byDay = new Map(fallback.map((r) => [r.day, r]));
    const firstDataKey = fallback.length ? fallback[0].day : todayKey;
    trafficRows = Array.from({ length: days }, (_, i) => {
      const key = shiftDayKey(todayKey, -i);
      const prevKey = shiftDayKey(key, -7);
      const cur = byDay.get(key);
      const prev = byDay.get(prevKey);
      const visitorsToday = cur?.visitors ?? 0;
      const visitorsPrev = prev?.visitors ?? 0;
      const hasPrev = prevKey >= firstDataKey;
      return {
        key, prevKey,
        weekday: istWeekday(`${key}T06:00:00Z`),
        visitors: visitorsToday,
        views: cur?.pageviews ?? 0,
        carts: cur?.carts ?? 0,
        identified: cur?.identified ?? 0,
        prevVisitors: visitorsPrev,
        delta: hasPrev ? visitorsToday - visitorsPrev : null,
        pct: hasPrev && visitorsPrev > 0 ? Math.round(((visitorsToday - visitorsPrev) / visitorsPrev) * 100) : null,
      };
    });
  }
  const peakVisitors = Math.max(1, ...trafficRows.map((r) => r.visitors));
  const windowTotal = trafficRows.reduce((s, r) => s + r.visitors, 0);
  const prevWindowTotal = trafficRows.reduce((s, r) => s + r.prevVisitors, 0);
  const windowDelta = prevWindowTotal > 0 ? Math.round(((windowTotal - prevWindowTotal) / prevWindowTotal) * 100) : null;

  const topPages = [...pageAgg.entries()]
    .filter(([, a]) => a.views > 0)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 15);
  const maxViews = topPages[0]?.[1].views ?? 1;
  const durTxt = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
  const showPages = view === "pages";
  const showPdp = view === "pdp";

  /* ── Product-page drop-off: how far down the PDP visitors actually get.
     Unit = one (visitor, product) pair. Sections come from pdp_section
     events (fired once per section per pageview by PdpTelemetry), photo
     behaviour from pdp_image, the finish line from add_to_cart. ── */
  const isPdpPath = (x: string) => /^\/catalogue\/[^\/?#]+/.test(x);
  const PDP_SECS: [string, string][] = [
    ["gallery", "Photo gallery"], ["quickspecs", "Quick specs"], ["buybox", "Buy box"],
    ["wholesale", "Wholesale strip"], ["price-history", "Price history"], ["trust", "Trust badges"],
    ["about", "About the product"], ["specs", "Specifications"], ["range", "Full range table"],
    ["guide", "Buying guide"], ["faq", "FAQ"], ["reviews", "Reviews"],
  ];
  const pdpVisits = new Set<string>();
  const secReach = new Map<string, Set<string>>(PDP_SECS.map(([k]) => [k, new Set()]));
  const imgActs = new Map<string, number>();
  const imgVisits = new Set<string>();
  const atcVisits = new Set<string>();
  const perProduct = new Map<string, { views: number; price: Set<string>; atc: Set<string>; img: Set<string> }>();
  if (showPdp) {
    for (const e of events) {
      if (!keptSids.has(e.sid)) continue;
      const path = (e.path ?? "").split("?")[0];
      if (!isPdpPath(path)) continue;
      if (brand && productByPath.get(path)?.brand !== brand) continue;
      const key = `${e.sid}|${path}`;
      const prod = () => {
        let a = perProduct.get(path);
        if (!a) { a = { views: 0, price: new Set(), atc: new Set(), img: new Set() }; perProduct.set(path, a); }
        return a;
      };
      if (e.type === "pageview") { pdpVisits.add(key); prod().views += 1; }
      else if (e.type === "pdp_section") {
        const sec = String((e.detail as Record<string, unknown> | null)?.sec ?? "");
        secReach.get(sec)?.add(key);
        if (sec === "price-history") prod().price.add(e.sid);
      } else if (e.type === "pdp_image") {
        const act = String((e.detail as Record<string, unknown> | null)?.act ?? "other");
        imgActs.set(act, (imgActs.get(act) ?? 0) + 1);
        imgVisits.add(key); prod().img.add(e.sid);
      } else if (e.type === "add_to_cart") { atcVisits.add(key); prod().atc.add(e.sid); }
    }
  }
  const pdpTotal = pdpVisits.size;
  const pdpWorst = [...perProduct.entries()]
    .filter(([, a]) => a.views >= 2)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 20);
  const IMG_ACT_LABEL: Record<string, string> = { open: "Opened the viewer", thumb: "Switched thumbnails", arrow: "Browsed photos", zoom: "Zoomed in", hover: "Hover-magnified" };

  // Switching tab or day range must not silently drop the filters someone has
  // set - rebuild the query string instead of writing a fresh one.
  const linkTo = (over: { days?: number; view?: string }) => {
    const q = new URLSearchParams();
    q.set("days", String(over.days ?? days));
    const v = over.view !== undefined ? over.view : view ?? "";
    if (v) q.set("view", v);
    for (const [k, val] of Object.entries({ identity, device, country, state, src, min, bots, brand })) {
      if (val) q.set(k, String(val));
    }
    return `/admin/analytics?${q.toString()}`;
  };
  const eventsBySid = new Map<string, SiteEvent[]>();
  for (const e of events) (eventsBySid.get(e.sid) ?? eventsBySid.set(e.sid, []).get(e.sid)!).push(e);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Analytics</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>
        Every visitor's journey: pages, time spent, taps, searches, device and location. Open a visitor to see their full activity.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {[1, 7, 14, 30, 90].map((n) => (
          <Link key={n} href={linkTo({ days: n })} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: days === n ? "#16215B" : "#fff", color: days === n ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
            {n === 1 ? "24 hours" : `${n} days`}
          </Link>
        ))}
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{visitors.length} visitors · {identified} identified</span>
        <a href={`/admin/analytics/export?days=${days}`} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#1D2F8A" }}>⬇ Export CSV (raw events)</a>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([["", "Visitors"], ["traffic", "Daily traffic"], ["pages", "Top products"], ["pdp", "Product page"], ["search", "Searches"]] as [string, string][]).map(([key, label]) => {
          const active = (view ?? "") === key;
          return (
            <Link key={label} href={linkTo({ view: key })} style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: active ? "#16215B" : "#fff", color: active ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Filters countries={countries} states={states} devices={deviceOSes} brands={brands} />
      </div>

      {isTraffic && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>{is24h ? "Unique visitors per hour" : "Unique visitors per day"}</span>
            <span style={{ color: "#8A93A6", fontWeight: 400, fontSize: 12.5 }}>
              {is24h ? "· last 24 hours · each bar is one hour · humans, whole site" : `· last ${days} days · each bar is one IST day · humans, whole site (aggregated in-database)`}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#56627A" }}>
              <b style={{ color: "#19202E" }}>{windowTotal}</b> {is24h ? "visitor-hours" : "visitor-days"}
              {windowDelta != null && (
                <span style={{ color: windowDelta > 0 ? "#1F9D63" : windowDelta < 0 ? "#B43A16" : "#8A93A6", fontWeight: 700 }}>
                  {" "}· {windowDelta > 0 ? "▲" : windowDelta < 0 ? "▼" : "="} {Math.abs(windowDelta)}% vs {is24h ? "the previous 24 hours" : `previous ${days} days`}
                </span>
              )}
            </span>
          </div>

          {/* Chart: oldest on the left, newest on the right, like every other
              time series people read. */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, padding: "22px 18px 10px", height: 190, overflowX: "auto" }}>
            {[...trafficRows].reverse().map((r) => {
              const h = Math.round((r.visitors / peakVisitors) * 140);
              const up = r.delta != null && r.delta > 0;
              const down = r.delta != null && r.delta < 0;
              return (
                <div key={r.key} style={{ flex: "1 0 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 26 }}
                     title={`${r.key} (${r.weekday}) - ${r.visitors} unique visitor${r.visitors === 1 ? "" : "s"}${r.delta != null ? ` · ${r.delta >= 0 ? "+" : ""}${r.delta} vs ${r.prevKey}` : ""}`}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: r.visitors ? "#19202E" : "#C6CBD6" }}>{r.visitors}</span>
                  <div style={{ width: "100%", height: Math.max(h, r.visitors ? 3 : 1), borderRadius: "4px 4px 0 0", background: up ? "#1F9D63" : down ? "#E9967A" : "#1D2F8A", opacity: r.visitors ? 1 : 0.25 }} />
                  <span style={{ fontSize: 9.5, color: "#8A93A6", whiteSpace: "nowrap" }}>{r.weekday}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "0 18px 14px", fontSize: 11, color: "#A0A7B5" }}>
            {is24h ? "Green = up on the same hour yesterday · orange = down" : "Green = up on the same weekday last week · orange = down · blue = no comparison yet"}
          </div>

          {/* Table: newest first, because that is what you check in the morning. */}
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px 90px 90px 150px", gap: 10, padding: "10px 18px", fontSize: 11, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", borderTop: "1px solid #F0F2F6", borderBottom: "1px solid #F0F2F6" }}>
            <span>{is24h ? "Hour" : "Day"}</span><span /><span style={{ textAlign: "right" }}>Visitors</span><span style={{ textAlign: "right" }}>Pageviews</span><span style={{ textAlign: "right" }}>Carts</span><span style={{ textAlign: "right" }}>{is24h ? "vs same hour yesterday" : "vs same day last week"}</span>
          </div>
          {trafficRows.map((r, i) => (
            <div key={r.key} style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px 90px 90px 150px", gap: 10, padding: "10px 18px", alignItems: "center", borderTop: i ? "1px solid #F5F6F9" : undefined, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#19202E" }}>
                {is24h ? r.key : istDate(`${r.key}T06:00:00Z`)} <span style={{ color: "#A0A7B5", fontWeight: 400 }}>{r.weekday}</span>
                {r.key === todayKey && <span style={{ marginLeft: 6, fontSize: 10, color: "#1D2F8A", fontWeight: 700 }}>today</span>}
              </span>
              <span>
                <span style={{ display: "block", height: 8, borderRadius: 4, background: "#E9EDF9", width: `${Math.round((r.visitors / peakVisitors) * 100)}%`, minWidth: r.visitors ? 6 : 0 }} />
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--space-grotesk)", fontWeight: 700 }}>{r.visitors}</span>
              <span style={{ textAlign: "right", color: "#56627A" }}>{r.views}</span>
              <span style={{ textAlign: "right", color: r.carts ? "#1F9D63" : "#A0A7B5", fontWeight: r.carts ? 700 : 400 }}>{r.carts}</span>
              <span style={{ textAlign: "right", fontSize: 12.5 }}>
                {r.delta == null ? (
                  <span style={{ color: "#C6CBD6" }}>no data</span>
                ) : (
                  <>
                    <b style={{ color: r.delta > 0 ? "#1F9D63" : r.delta < 0 ? "#B43A16" : "#8A93A6" }}>
                      {r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "="} {r.delta === 0 ? "same" : Math.abs(r.delta)}
                    </b>
                    <span style={{ color: "#8A93A6" }}>
                      {r.pct != null && r.delta !== 0 ? ` (${r.pct > 0 ? "+" : ""}${r.pct}%)` : ""} · was {r.prevVisitors}
                    </span>
                  </>
                )}
              </span>
            </div>
          ))}
          <div style={{ padding: "12px 18px", borderTop: "1px solid #F0F2F6", fontSize: 11.5, color: "#8A93A6" }}>
            A unique visitor is one device in one {is24h ? "hour" : "IST day"}. Bot sessions are excluded in the database
            (migration 0127); this tab shows whole-site human traffic and ignores the dropdown filters.
          </div>
        </div>
      )}

      {showPages && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontWeight: 700, fontSize: 14.5 }}>
            Top product pages <span style={{ color: "#8A93A6", fontWeight: 400 }}>· {is24h ? "last 24 hours" : `last ${days} days`}{brand ? ` · ${brand}` : ""} · humans in current filter</span>
          </div>
          {topPages.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>No product views in this window.</div>}
          {topPages.map(([path, a], i) => {
            const prod = productByPath.get(path);
            return (
              <div key={path} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderTop: i ? "1px solid #F5F6F9" : undefined, position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round((a.views / maxViews) * 100)}%`, background: "#F0F2FE", zIndex: 0 }} />
                <span style={{ zIndex: 1, width: 22, fontFamily: "var(--space-mono)", fontSize: 12, fontWeight: 700, color: "#8A93A6" }}>{i + 1}</span>
                <a href={path} target="_blank" style={{ zIndex: 1, flex: 1, fontSize: 13.5, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {prod ? prod.name : path}
                  {prod && <span style={{ color: "#8A93A6", fontWeight: 400 }}> · {prod.brand}</span>}
                </a>
                <span style={{ zIndex: 1, fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}><b style={{ color: "#19202E" }}>{a.views}</b> views</span>
                <span style={{ zIndex: 1, fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}>{a.sids.size} visitor{a.sids.size === 1 ? "" : "s"}</span>
                <span style={{ zIndex: 1, fontSize: 12, color: "#8A93A6", whiteSpace: "nowrap" }}>{a.ms > 0 ? `${durTxt(Math.round(a.ms / Math.max(a.views, 1)))} avg` : ""}</span>
              </div>
            );
          })}
        </div>
      )}

      {showPdp && (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 20 }}>
          {pdpTotal === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
              No product-page data yet in this window. Section and photo events start flowing from the deploy that added them - give it a day of traffic.
            </div>
          ) : (
            <>
              {/* ── Section funnel: where the page loses people ── */}
              <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontWeight: 700, fontSize: 14.5 }}>
                  How far down the product page people get
                  <span style={{ color: "#8A93A6", fontWeight: 400 }}> · {pdpTotal} product visits · last {days} days</span>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  {PDP_SECS.map(([k, label]) => {
                    const n = secReach.get(k)?.size ?? 0;
                    const pct = Math.round((n / pdpTotal) * 100);
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "5px 0" }}>
                        <span style={{ width: 150, fontSize: 12.5, fontWeight: 600, color: "#3A4358", flex: "none" }}>{label}</span>
                        <div style={{ flex: 1, height: 18, background: "#F5F6F9", borderRadius: 6, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: pct > 60 ? "#1D2F8A" : pct > 30 ? "#8B96EA" : "#C6CDF5", borderRadius: 6 }} />
                        </div>
                        <span style={{ width: 84, fontSize: 12.5, color: "#56627A", textAlign: "right", flex: "none" }}><b style={{ color: "#19202E" }}>{pct}%</b> · {n}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0 4px", borderTop: "1px dashed #E8EBF1", marginTop: 8 }}>
                    <span style={{ width: 150, fontSize: 12.5, fontWeight: 800, color: "#137a4b", flex: "none" }}>🛒 Added to cart</span>
                    <div style={{ flex: 1, height: 18, background: "#F5F6F9", borderRadius: 6, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((atcVisits.size / pdpTotal) * 100)}%`, height: "100%", background: "#1F9D63", borderRadius: 6 }} />
                    </div>
                    <span style={{ width: 84, fontSize: 12.5, color: "#56627A", textAlign: "right", flex: "none" }}><b style={{ color: "#137a4b" }}>{Math.round((atcVisits.size / pdpTotal) * 100)}%</b> · {atcVisits.size}</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: "#8A93A6", margin: "10px 0 0" }}>
                    A section counts when at least a third of it entered the viewport. Sections that only exist on some products (wholesale, range, guide) naturally read lower.
                  </p>
                </div>
              </div>

              {/* ── Photo behaviour ── */}
              <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontWeight: 700, fontSize: 14.5 }}>
                  Photo behaviour
                  <span style={{ color: "#8A93A6", fontWeight: 400 }}> · are people trying to see more of the product?</span>
                </div>
                <div style={{ display: "flex", gap: 26, flexWrap: "wrap", padding: "16px 18px" }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--space-grotesk)" }}>{Math.round((imgVisits.size / pdpTotal) * 100)}%</div>
                    <div style={{ fontSize: 12, color: "#8A93A6" }}>of product visits touched the photos</div>
                  </div>
                  {Object.entries(IMG_ACT_LABEL).map(([act, label]) => (
                    <div key={act}>
                      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--space-grotesk)" }}>{imgActs.get(act) ?? 0}</div>
                      <div style={{ fontSize: 12, color: "#8A93A6" }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Per-product drop-off ── */}
              <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontWeight: 700, fontSize: 14.5 }}>
                  Most-viewed products <span style={{ color: "#8A93A6", fontWeight: 400 }}>· who saw the proof, who added to cart</span>
                </div>
                {pdpWorst.map(([path, a], i) => (
                  <div key={path} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 18px", borderTop: i ? "1px solid #F5F6F9" : undefined }}>
                    <span style={{ width: 22, fontFamily: "var(--space-mono)", fontSize: 12, fontWeight: 700, color: "#8A93A6" }}>{i + 1}</span>
                    <a href={path} target="_blank" style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path.replace("/catalogue/", "")}</a>
                    <span style={{ fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}><b style={{ color: "#19202E" }}>{a.views}</b> views</span>
                    <span style={{ fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}>{a.price.size} saw price proof</span>
                    <span style={{ fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}>{a.img.size} touched photos</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: a.atc.size ? "#137a4b" : "#B43A16", whiteSpace: "nowrap" }}>{a.atc.size} 🛒</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {isSearch && searchStats && <SearchPanel data={searchStats} />}

      {showPages || isTraffic || showPdp || isSearch ? null : visitors.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No visits recorded yet. Data starts flowing once migration 0051 is run and the site is redeployed.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          {visitors.slice(0, 200).map((v, i) => {
            const journey = buildJourney(eventsBySid.get(v.sid) ?? [], searchesBySid.get(v.sid) ?? []).slice(0, 400);
            return (
              <details key={v.sid} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined }}>
                <summary style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "13px 16px", flexWrap: "wrap", cursor: "pointer", listStyle: "none" }}>
                  <span style={{ color: "#A0A7B5", fontSize: 11 }}>▸</span>
                  <span style={{ minWidth: 220 }}>
                    <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: v.identity.email ? "#137a4b" : "#19202E" }}>
                      {v.identity.name || v.identity.email || `Anonymous · ${v.sid.slice(0, 6)}`}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#1D2F8A" }}>{v.identity.email ?? "not identified yet"}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "#56627A", minWidth: 160 }}>{v.location ?? "location unknown"}{v.ip ? ` · ${v.ip}` : ""}</span>
                  <span style={{ fontSize: 12, color: "#56627A", minWidth: 140 }}>{v.device ?? "–"}</span>
                  <span style={{ fontSize: 12, color: "#56627A" }}>
                    {v.pageviews} pages · {v.clicks} taps{v.addToCarts ? ` · ${v.addToCarts} add-to-cart` : ""} · {dur(v.totalMs)}
                  </span>
                  {(v.utm || v.landingReferrer) && (
                    <span style={{ fontSize: 11.5, color: "#C77700" }}>{v.utm ?? hostOf(v.landingReferrer)}</span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap" }}>{istDateTime(v.lastSeen)}</span>
                </summary>

                <div style={{ background: "#F8F9FC", borderTop: "1px solid #F0F2F6", padding: "4px 0 10px" }}>
                  {journey.length === 0 && <div style={{ padding: "14px 46px", fontSize: 12.5, color: "#8A93A6" }}>No recorded activity in this window.</div>}
                  {journey.map((it, j) => {
                    const day = istDate(it.at);
                    const prevDay = j > 0 ? istDate(journey[j - 1].at) : null;
                    return (
                      <div key={j}>
                        {day !== prevDay && (
                          <div style={{ padding: "9px 46px 3px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#A0A7B5" }}>{day}</div>
                        )}
                        <div style={{ display: "flex", gap: 11, alignItems: "baseline", padding: "4px 46px" }}>
                          <span style={{ fontFamily: "var(--space-mono)", fontSize: 10.5, color: "#A0A7B5", minWidth: 58 }}>
                            {istTime(it.at)}
                          </span>
                          <span style={{ fontSize: 12.5 }}>{it.icon}</span>
                          <span style={{ fontSize: 12.5, color: "#19202E" }}>
                            {it.title}
                            {it.sub && <span style={{ color: "#8A93A6", fontSize: 11 }}> · {it.sub}</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}
