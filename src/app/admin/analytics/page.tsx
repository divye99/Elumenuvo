import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchEvents, fetchAllSearches, toVisitors, buildJourney, type SiteEvent } from "@/lib/admin/analytics-data";
import { istDateTime, istDate, istTime } from "@/lib/admin/ist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const { days: d } = await searchParams;
  const days = Math.min(90, Math.max(1, Number(d) || 14));
  const [events, searchesBySid] = await Promise.all([fetchEvents(days), fetchAllSearches(days)]);
  const visitors = toVisitors(events);
  const identified = visitors.filter((v) => v.identity.email).length;
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
          <Link key={n} href={`/admin/analytics?days=${n}`} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: days === n ? "#161D2B" : "#fff", color: days === n ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
            {n} days
          </Link>
        ))}
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{visitors.length} visitors · {identified} identified · {events.length} events</span>
        <a href={`/admin/analytics/export?days=${days}`} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#4E5BDC" }}>⬇ Export CSV (raw events)</a>
      </div>

      {visitors.length === 0 ? (
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
