import { istDateTime } from "@/lib/admin/ist";
import type { SearchAnalytics, SearchTermStat } from "@/lib/admin/search-analytics";

/**
 * Analytics → Searches: what people type into the store.
 *
 * The bubble cloud answers "what do people want" at a glance - bubble size is
 * search frequency, colour is outcome (green found products, red never has).
 * Under it, the missed-demand table lists the red bubbles in rankable form:
 * every row is a product, brand or category visitors asked for and left
 * without. That list is a purchase-request report written by customers.
 */

const dot = (c: string): React.CSSProperties => ({ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block", marginRight: 6 });

export default function SearchPanel({ data }: { data: SearchAnalytics }) {
  const maxCount = Math.max(1, ...data.terms.map((t) => t.count));

  // sqrt scale keeps one runaway query from dwarfing everything else.
  const sizeFor = (count: number) => {
    const r = Math.sqrt(count / maxCount);
    return { font: 11 + Math.round(r * 11), pad: 6 + Math.round(r * 8) };
  };

  const bubbleStyle = (t: SearchTermStat): React.CSSProperties => {
    const { font, pad } = sizeFor(t.count);
    const missedTerm = t.maxResults === 0 && t.picks === 0;
    const unknown = t.maxResults < 0 && t.picks === 0; // suggest-only, outcome never measured
    return {
      fontSize: font, fontWeight: 600, lineHeight: 1,
      padding: `${pad}px ${pad + 6}px`, borderRadius: 999,
      background: missedTerm ? "#FBE9E4" : unknown ? "#F5F6F9" : "#E6F5EE",
      color: missedTerm ? "#9a3b16" : unknown ? "#56627A" : "#137a4b",
      border: `1px solid ${missedTerm ? "#F0BBA8" : unknown ? "#E0E4ED" : "#B6E2C8"}`,
      whiteSpace: "nowrap", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis",
    };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 20 }}>
      {/* ── Headline numbers ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "15px 18px", display: "flex", gap: 26, flexWrap: "wrap", alignItems: "baseline" }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>Searches</span>
        <Stat label="searches" value={String(data.totalSearches)} />
        <Stat label="distinct queries" value={String(data.distinctQueries)} />
        <Stat label="found nothing" value={`${Math.round(data.zeroRate * 100)}%`} warn={data.zeroRate > 0.25} />
        <Stat label="missed-demand queries" value={String(data.missed.length)} warn={data.missed.length > 0} />
      </div>

      {/* ── Bubble cloud ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 18, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>What people search</span>
          <span style={{ fontSize: 12, color: "#8A93A6" }}>size = how often · <span style={dot("#1F9D63")} />finds products · <span style={dot("#C0392B")} />never has · <span style={dot("#AEB6C4")} />typed in suggest only</span>
        </div>
        {data.terms.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>No searches logged in this window yet.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
            {data.terms.slice(0, 120).map((t) => (
              <span key={t.norm} style={bubbleStyle(t)} title={`${t.count}× · ${t.sessions} visitor${t.sessions === 1 ? "" : "s"} · ${t.maxResults >= 0 ? `best ${t.maxResults} results` : "outcome unmeasured"}${t.picks ? ` · ${t.picks} pick${t.picks === 1 ? "" : "s"}` : ""}`}>
                {t.q}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Missed demand ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Searched for, not carried</span>
          <p style={{ fontSize: 12, color: "#8A93A6", margin: "5px 0 0", maxWidth: 760 }}>
            Every query here has NEVER matched a product, and nothing was ever picked from it. Rows with a
            &quot;customers corrected to&quot; note are spelling gaps the search now rescues; the rest are brands,
            categories or parts visitors wanted and left without - a stocking wishlist written by customers.
          </p>
        </div>
        {data.missed.length === 0 ? (
          <div style={{ padding: "34px 20px", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>
            Nothing missed in this window - every search found at least one product. 🎉
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#8A93A6", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <th style={{ padding: "9px 18px", fontWeight: 700 }}>Query</th>
                  <th style={{ padding: "9px 10px", fontWeight: 700, textAlign: "right" }}>Searches</th>
                  <th style={{ padding: "9px 10px", fontWeight: 700, textAlign: "right" }}>Visitors</th>
                  <th style={{ padding: "9px 10px", fontWeight: 700 }}>Reading</th>
                  <th style={{ padding: "9px 18px", fontWeight: 700 }}>Last searched</th>
                </tr>
              </thead>
              <tbody>
                {data.missed.map((t, i) => (
                  <tr key={t.norm} style={{ borderTop: i ? "1px solid #F5F6F9" : "1px solid #F0F2F6" }}>
                    <td style={{ padding: "10px 18px", fontWeight: 700, color: "#19202E" }}>{t.q}</td>
                    <td style={{ padding: "10px", textAlign: "right", color: "#56627A" }}>{t.count}</td>
                    <td style={{ padding: "10px", textAlign: "right", color: "#56627A" }}>{t.sessions}</td>
                    <td style={{ padding: "10px", fontSize: 12 }}>
                      {t.correctedTo
                        ? <span style={{ color: "#C77700" }}>spelling · customers corrected to “{t.correctedTo}”</span>
                        : <span style={{ color: "#9a3b16", fontWeight: 600 }}>demand we don&apos;t carry</span>}
                    </td>
                    <td style={{ padding: "10px 18px", color: "#A0A7B5", whiteSpace: "nowrap" }}>{istDateTime(t.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <span style={{ fontSize: 12.5, color: "#8A93A6" }}>
      <b style={{ fontSize: 15, color: warn ? "#C0392B" : "#19202E", marginRight: 5 }}>{value}</b>{label}
    </span>
  );
}
