import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchEvents, toVisitors } from "@/lib/admin/analytics-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
const dt = (v: string) => new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function AdminAnalytics({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const { days: d } = await searchParams;
  const days = Math.min(90, Math.max(1, Number(d) || 14));
  const events = await fetchEvents(days);
  const visitors = toVisitors(events);
  const identified = visitors.filter((v) => v.identity.email).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Analytics</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>
        Every visitor's journey: pages, time spent, taps, searches, device and location. Click a visitor for the full timeline.
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
          {visitors.slice(0, 200).map((v, i) => (
            <Link key={v.sid} href={`/admin/analytics/${v.sid}`} style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "13px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, flexWrap: "wrap", color: "inherit" }}>
              <div style={{ minWidth: 230 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: v.identity.email ? "#137a4b" : "#19202E" }}>
                  {v.identity.name || v.identity.email || `Anonymous · ${v.sid.slice(0, 6)}`}
                </div>
                <div style={{ fontSize: 11.5, color: "#4E5BDC" }}>{v.identity.email ?? "not identified yet"}</div>
              </div>
              <div style={{ fontSize: 12, color: "#56627A", minWidth: 170 }}>{v.location ?? "location unknown"}{v.ip ? ` · ${v.ip}` : ""}</div>
              <div style={{ fontSize: 12, color: "#56627A", minWidth: 150 }}>{v.device ?? "–"}</div>
              <div style={{ fontSize: 12, color: "#56627A" }}>
                {v.pageviews} pages · {v.clicks} taps{v.addToCarts ? ` · ${v.addToCarts} add-to-cart` : ""} · {dur(v.totalMs)}
              </div>
              {(v.utm || v.landingReferrer) && (
                <div style={{ fontSize: 11.5, color: "#C77700" }}>{v.utm ?? new URL(v.landingReferrer!).hostname}</div>
              )}
              <div style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap" }}>{dt(v.lastSeen)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
