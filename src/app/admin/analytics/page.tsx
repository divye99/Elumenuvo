import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchEvents, fetchAllSearches, toVisitors, buildJourney, type SiteEvent } from "@/lib/admin/analytics-data";
import { istDateTime, istDate, istTime, istDayKey, istWeekday, shiftDayKey } from "@/lib/admin/ist";
import Filters from "./Filters";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ days?: string; identity?: string; device?: string; country?: string; state?: string; src?: string; min?: string; bots?: string; view?: string }> }) {
  await requireAdmin();
  const { days: d, identity, device, country, state, src, min, bots, view } = await searchParams;
  const days = Math.min(90, Math.max(1, Number(d) || 14));
  // The traffic tab compares each day with the same weekday a week earlier, so
  // it has to see one extra week behind the selected window.
  const isTraffic = view === "traffic";
  const fetchDays = isTraffic ? Math.min(97, days + 7) : days;
  const [events, searchesBySid] = await Promise.all([fetchEvents(fetchDays), fetchAllSearches(days)]);
  const allVisitors = toVisitors(events);

  // Dropdown options come from the data itself. India leads the country list.
  const countries = [...new Set(allVisitors.map((v) => v.country).filter(Boolean) as string[])]
    .sort((a, b) => (a === "IN" ? -1 : b === "IN" ? 1 : a.localeCompare(b)));
  const states = [...new Set(allVisitors.filter((v) => !country || v.country === country).map((v) => v.region).filter(Boolean) as string[])].sort();
  const deviceOSes = [...new Set(allVisitors.map((v) => v.device?.split(" · ")[0]).filter(Boolean) as string[])].sort();

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
      if (src === "email" && !(v.utm ?? "").startsWith("email")) return false;
      if (src === "campaign" && (!v.utm || (v.utm ?? "").startsWith("email"))) return false;
      if (src === "referral" && (!ref || ref.includes("google") || v.utm)) return false;
      if (src === "direct" && (ref || v.utm)) return false;
    }
    if (min === "cart" && !v.addToCarts) return false;
    if (min && min !== "cart" && v.pageviews < Number(min)) return false;
    return true;
  });
  const identified = visitors.filter((v) => v.identity.email).length;

  // Top pages: pageview counts across the filtered sessions only, so the
  // bot-hiding and dropdown filters shape this view too.
  const keptSids = new Set(visitors.map((v) => v.sid));
  const pageAgg = new Map<string, { views: number; sids: Set<string>; ms: number }>();
  for (const e of events) {
    if (!keptSids.has(e.sid)) continue;
    const path = e.path ?? "/";
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
  // ── Daily traffic: UNIQUE VISITORS per IST day ──
  // A visitor is one device token (sid). Someone who visits three times in a
  // day counts once; someone who visits on Monday and Tuesday counts on both.
  const dayAgg = new Map<string, { sids: Set<string>; views: number; carts: Set<string>; identified: Set<string> }>();
  const bucket = (k: string) => {
    let a = dayAgg.get(k);
    if (!a) { a = { sids: new Set(), views: 0, carts: new Set(), identified: new Set() }; dayAgg.set(k, a); }
    return a;
  };
  const emailBySid = new Map(visitors.filter((v) => v.identity.email).map((v) => [v.sid, v.identity.email!]));
  for (const e of events) {
    if (!keptSids.has(e.sid)) continue;
    const k = istDayKey(e.created_at);
    if (e.type === "pageview") { const a = bucket(k); a.sids.add(e.sid); a.views += 1; if (emailBySid.has(e.sid)) a.identified.add(e.sid); }
    else if (e.type === "add_to_cart") bucket(k).carts.add(e.sid);
  }
  // Every day in the selected window, newest first, even the empty ones - a
  // zero-traffic day is information, and skipping it would hide a gap.
  const todayKey = istDayKey(new Date());
  // Tracking only began in July, so a 30- or 90-day window reaches back past
  // the first event we ever recorded. Comparing against those days would read
  // "down 12" when the truth is "we were not counting yet", so anything older
  // than the first event we hold gets no comparison at all.
  const earliestKey = events.length ? istDayKey(events[events.length - 1].created_at) : todayKey;
  const firstDataKey = events.reduce((min, e) => {
    const k = istDayKey(e.created_at);
    return k < min ? k : min;
  }, earliestKey);
  const trafficRows = Array.from({ length: days }, (_, i) => {
    const key = shiftDayKey(todayKey, -i);
    const prevKey = shiftDayKey(key, -7);
    const cur = dayAgg.get(key);
    const prev = dayAgg.get(prevKey);
    const visitorsToday = cur?.sids.size ?? 0;
    const visitorsPrev = prev?.sids.size ?? 0;
    // A comparison only exists if we actually hold data for that earlier day.
    const hasPrev = prevKey >= firstDataKey;
    return {
      key, prevKey,
      weekday: istWeekday(`${key}T06:00:00Z`),
      visitors: visitorsToday,
      views: cur?.views ?? 0,
      carts: cur?.carts.size ?? 0,
      identified: cur?.identified.size ?? 0,
      prevVisitors: visitorsPrev,
      delta: hasPrev ? visitorsToday - visitorsPrev : null,
      pct: hasPrev && visitorsPrev > 0 ? Math.round(((visitorsToday - visitorsPrev) / visitorsPrev) * 100) : null,
    };
  });
  const peakVisitors = Math.max(1, ...trafficRows.map((r) => r.visitors));
  const windowTotal = trafficRows.reduce((s, r) => s + r.visitors, 0);
  const prevWindowTotal = trafficRows.reduce((s, r) => s + r.prevVisitors, 0);
  const windowDelta = prevWindowTotal > 0 ? Math.round(((windowTotal - prevWindowTotal) / prevWindowTotal) * 100) : null;

  const topPages = [...pageAgg.entries()]
    .filter(([, a]) => a.views > 0)
    .sort((a, b) => b[1].views - a[1].views)
    .slice(0, 10);
  const maxViews = topPages[0]?.[1].views ?? 1;
  const durTxt = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
  const showPages = view === "pages";
  // Switching tab or day range must not silently drop the filters someone has
  // set - rebuild the query string instead of writing a fresh one.
  const linkTo = (over: { days?: number; view?: string }) => {
    const q = new URLSearchParams();
    q.set("days", String(over.days ?? days));
    const v = over.view !== undefined ? over.view : view ?? "";
    if (v) q.set("view", v);
    for (const [k, val] of Object.entries({ identity, device, country, state, src, min, bots })) {
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
        {[7, 14, 30, 90].map((n) => (
          <Link key={n} href={linkTo({ days: n })} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: days === n ? "#161D2B" : "#fff", color: days === n ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
            {n} days
          </Link>
        ))}
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{visitors.length} of {allVisitors.length} visitors · {identified} identified · {events.length} events</span>
        <a href={`/admin/analytics/export?days=${days}`} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#4E5BDC" }}>⬇ Export CSV (raw events)</a>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {([["", "Visitors"], ["traffic", "Daily traffic"], ["pages", "Top pages"]] as [string, string][]).map(([key, label]) => {
          const active = (view ?? "") === key;
          return (
            <Link key={label} href={linkTo({ view: key })} style={{ fontSize: 13, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: active ? "#161D2B" : "#fff", color: active ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
              {label}
            </Link>
          );
        })}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Filters countries={countries} states={states} devices={deviceOSes} />
      </div>

      {isTraffic && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14.5 }}>Unique visitors per day</span>
            <span style={{ color: "#8A93A6", fontWeight: 400, fontSize: 12.5 }}>
              · last {days} days · each bar is one IST day · humans in current filter
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#56627A" }}>
              <b style={{ color: "#19202E" }}>{windowTotal}</b> visitor-days
              {windowDelta != null && (
                <span style={{ color: windowDelta > 0 ? "#1F9D63" : windowDelta < 0 ? "#B43A16" : "#8A93A6", fontWeight: 700 }}>
                  {" "}· {windowDelta > 0 ? "▲" : windowDelta < 0 ? "▼" : "="} {Math.abs(windowDelta)}% vs previous {days} days
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
                  <div style={{ width: "100%", height: Math.max(h, r.visitors ? 3 : 1), borderRadius: "4px 4px 0 0", background: up ? "#1F9D63" : down ? "#E9967A" : "#4E5BDC", opacity: r.visitors ? 1 : 0.25 }} />
                  <span style={{ fontSize: 9.5, color: "#8A93A6", whiteSpace: "nowrap" }}>{r.weekday}</span>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "0 18px 14px", fontSize: 11, color: "#A0A7B5" }}>
            Green = up on the same weekday last week · orange = down · blue = no comparison yet
          </div>

          {/* Table: newest first, because that is what you check in the morning. */}
          <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px 90px 90px 150px", gap: 10, padding: "10px 18px", fontSize: 11, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", borderTop: "1px solid #F0F2F6", borderBottom: "1px solid #F0F2F6" }}>
            <span>Day</span><span /><span style={{ textAlign: "right" }}>Visitors</span><span style={{ textAlign: "right" }}>Pageviews</span><span style={{ textAlign: "right" }}>Carts</span><span style={{ textAlign: "right" }}>vs same day last week</span>
          </div>
          {trafficRows.map((r, i) => (
            <div key={r.key} style={{ display: "grid", gridTemplateColumns: "150px 1fr 90px 90px 90px 150px", gap: 10, padding: "10px 18px", alignItems: "center", borderTop: i ? "1px solid #F5F6F9" : undefined, fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: "#19202E" }}>
                {istDate(`${r.key}T06:00:00Z`)} <span style={{ color: "#A0A7B5", fontWeight: 400 }}>{r.weekday}</span>
                {r.key === todayKey && <span style={{ marginLeft: 6, fontSize: 10, color: "#4E5BDC", fontWeight: 700 }}>today</span>}
              </span>
              <span>
                <span style={{ display: "block", height: 8, borderRadius: 4, background: "#EEF0FE", width: `${Math.round((r.visitors / peakVisitors) * 100)}%`, minWidth: r.visitors ? 6 : 0 }} />
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
            A unique visitor is one device in one IST day: three visits in a day count once, and a visitor who returns
            the next day counts on both days. The same filters above apply here, so bots stay out unless you ask for them.
          </div>
        </div>
      )}

      {showPages && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontWeight: 700, fontSize: 14.5 }}>
            Top 10 pages <span style={{ color: "#8A93A6", fontWeight: 400 }}>· last {days} days · humans in current filter</span>
          </div>
          {topPages.length === 0 && <div style={{ padding: "36px 20px", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>No pageviews in this window.</div>}
          {topPages.map(([path, a], i) => (
            <div key={path} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px", borderTop: i ? "1px solid #F5F6F9" : undefined, position: "relative" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.round((a.views / maxViews) * 100)}%`, background: "#F0F2FE", zIndex: 0 }} />
              <span style={{ zIndex: 1, width: 22, fontFamily: "var(--space-mono)", fontSize: 12, fontWeight: 700, color: "#8A93A6" }}>{i + 1}</span>
              <a href={path} target="_blank" style={{ zIndex: 1, flex: 1, fontSize: 13.5, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{path}</a>
              <span style={{ zIndex: 1, fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}><b style={{ color: "#19202E" }}>{a.views}</b> views</span>
              <span style={{ zIndex: 1, fontSize: 12.5, color: "#56627A", whiteSpace: "nowrap" }}>{a.sids.size} visitor{a.sids.size === 1 ? "" : "s"}</span>
              <span style={{ zIndex: 1, fontSize: 12, color: "#8A93A6", whiteSpace: "nowrap" }}>{a.ms > 0 ? `${durTxt(Math.round(a.ms / Math.max(a.views, 1)))} avg` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {showPages || isTraffic ? null : visitors.length === 0 ? (
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
                    <span style={{ fontSize: 11.5, color: "#4E5BDC" }}>{v.identity.email ?? "not identified yet"}</span>
                  </span>
                  <span style={{ fontSize: 12, color: "#56627A", minWidth: 160 }}>{v.location ?? "location unknown"}{v.ip ? ` · ${v.ip}` : ""}</span>
                  <span style={{ fontSize: 12, color: "#56627A", minWidth: 140 }}>{v.device ?? "–"}</span>
                  <span style={{ fontSize: 12, color: "#56627A" }}>
                    {v.pageviews} pages · {v.clicks} taps{v.addToCarts ? ` · ${v.addToCarts} add-to-cart` : ""} · {dur(v.totalMs)}
                  </span>
                  {(v.utm || v.landingReferrer) && (
                    <span style={{ fontSize: 11.5, color: "#C77700" }}>{v.utm ?? new URL(v.landingReferrer!).hostname}</span>
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
