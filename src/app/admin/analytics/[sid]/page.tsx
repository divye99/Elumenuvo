import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { fetchEvents, fetchSearches, toVisitors } from "@/lib/admin/analytics-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** One visitor's complete, timewise journey: pageviews with time-on-page,
 *  taps, add-to-carts, searches (merged in from the search log, same sid)
 *  and the identify moments that name an anonymous history. */

const ICON: Record<string, string> = { pageview: "📄", leave: "⏱", click: "👆", product_click: "🛍", add_to_cart: "🛒", identify: "🪪", search: "🔎", suggest: "🔎" };
const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);

export default async function VisitorJourney({ params }: { params: Promise<{ sid: string }> }) {
  await requireAdmin();
  const { sid } = await params;
  const days = 90;
  const [events, searches] = await Promise.all([fetchEvents(days, sid), fetchSearches(sid, days)]);
  const v = toVisitors(events)[0];

  type Item = { at: string; icon: string; title: string; sub?: string };
  const items: Item[] = [];
  for (const e of events) {
    const d = (e.detail ?? {}) as Record<string, string>;
    if (e.type === "pageview") items.push({ at: e.created_at, icon: ICON.pageview, title: e.path ?? "/", sub: d.referrer_landing ? `arrived from ${d.referrer_landing}` : undefined });
    else if (e.type === "leave") items.push({ at: e.created_at, icon: ICON.leave, title: `spent ${dur(e.duration_ms ?? 0)} on ${e.path ?? "page"}` });
    else if (e.type === "product_click") items.push({ at: e.created_at, icon: ICON.product_click, title: `tapped product: ${d.label || d.product_id}`, sub: d.product_id });
    else if (e.type === "add_to_cart") items.push({ at: e.created_at, icon: ICON.add_to_cart, title: `added to cart (${d.label ?? ""})` });
    else if (e.type === "identify") items.push({ at: e.created_at, icon: ICON.identify, title: `identified as ${e.name || e.email}`, sub: e.email ?? undefined });
    else items.push({ at: e.created_at, icon: ICON.click, title: `tapped "${d.label ?? "?"}"`, sub: d.href });
  }
  for (const s of searches) {
    items.push({
      at: s.created_at,
      icon: ICON.search,
      title: s.source === "suggest" ? `picked suggestion "${s.picked}" after typing "${s.query}"` : `searched "${s.query}" (${s.results ?? "?"} results)`,
    });
  }
  items.sort((a, b) => (a.at < b.at ? -1 : 1));

  return (
    <div>
      <Link href="/admin/analytics" style={{ fontSize: 13, color: "#8A93A6" }}>← Analytics</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 2px" }}>
        {v?.identity.name || v?.identity.email || `Anonymous visitor ${sid.slice(0, 8)}`}
      </h1>
      <div style={{ fontSize: 13, color: "#56627A", marginBottom: 18 }}>
        {v?.identity.email && <span style={{ color: "#137a4b", fontWeight: 700 }}>{v.identity.email} · </span>}
        {v?.location ?? "location unknown"}{v?.ip ? ` · ${v.ip}` : ""} · {v?.device ?? "device unknown"} ·{" "}
        {v ? `${v.pageviews} pages · ${dur(v.totalMs)} on site` : ""}
        {v?.landingReferrer ? ` · came from ${new URL(v.landingReferrer).hostname}` : ""}
        {v?.utm ? ` · campaign ${v.utm}` : ""}
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "6px 0" }}>
        {items.length === 0 && <div style={{ padding: "30px 20px", color: "#8A93A6", fontSize: 14, textAlign: "center" }}>No events for this visitor in the last {days} days.</div>}
        {items.map((it, i) => {
          const day = new Date(it.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
          const prevDay = i > 0 ? new Date(items[i - 1].at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
          return (
            <div key={i}>
              {day !== prevDay && (
                <div style={{ padding: "10px 18px 4px", fontSize: 11, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#A0A7B5" }}>{day}</div>
              )}
              <div style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "7px 18px" }}>
                <span style={{ fontFamily: "var(--space-mono)", fontSize: 11, color: "#A0A7B5", minWidth: 62 }}>
                  {new Date(it.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span style={{ fontSize: 13 }}>{it.icon}</span>
                <span style={{ fontSize: 13, color: "#19202E" }}>
                  {it.title}
                  {it.sub && <span style={{ color: "#8A93A6", fontSize: 11.5 }}> · {it.sub}</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
