"use client";

import { useMemo, useState } from "react";
import { istDateTime } from "@/lib/admin/ist";
import type { SearchAnalytics, SearchTermStat } from "@/lib/admin/search-analytics";

/**
 * Analytics → Searches: what people type into the store.
 *
 * The term cloud answers "what do people want" at a glance - bubble size is
 * search frequency, colour is outcome (green found products, red never has,
 * grey typed only in suggest so the outcome was never measured). Bubbles are
 * laid out as an actual cloud: the biggest terms sit in the middle rows and
 * smaller ones taper toward the top and bottom edges. The colour legend
 * doubles as a filter. Under it, the missed-demand table lists the red
 * bubbles in rankable form - a purchase-request report written by customers.
 */

type Outcome = "found" | "missed" | "suggest";

const outcomeOf = (t: SearchTermStat): Outcome =>
  t.maxResults === 0 && t.picks === 0 ? "missed" : t.maxResults < 0 && t.picks === 0 ? "suggest" : "found";

const PALETTE: Record<Outcome, { bg: string; fg: string; border: string; dot: string; label: string }> = {
  found: { bg: "#E6F5EE", fg: "#137a4b", border: "#B6E2C8", dot: "#1F9D63", label: "finds products" },
  missed: { bg: "#FBE9E4", fg: "#9a3b16", border: "#F0BBA8", dot: "#C0392B", label: "never has" },
  suggest: { bg: "#F5F6F9", fg: "#56627A", border: "#E0E4ED", dot: "#AEB6C4", label: "suggest only" },
};

/**
 * Cloud layout: rows whose widths follow an ellipse, with the widest rows in
 * the middle. Terms arrive biggest-first and are placed into the row closest
 * to the centre that still has room, so frequency naturally maps to
 * centrality - exactly how a cloud reads.
 */
function cloudRows(terms: SearchTermStat[], sizeFor: (count: number) => { font: number; pad: number }): SearchTermStat[][] {
  if (terms.length === 0) return [];
  const est = (t: SearchTermStat) => {
    const { font, pad } = sizeFor(t.count);
    return Math.min(320, Math.min(t.q.length, 40) * font * 0.58 + (pad + 6) * 2) + 8; // + row gap
  };
  const totalWidth = terms.reduce((s, t) => s + est(t), 0);
  const maxRowWidth = 860;
  // An ellipse's rows average ~78% of the widest row, so size the row count to
  // actually hold everything - otherwise the overflow dumping flattens the shape.
  let rowCount = Math.max(3, Math.ceil(totalWidth / (maxRowWidth * 0.7)));
  if (rowCount % 2 === 0) rowCount += 1;
  const rows: { width: number; cap: number; items: SearchTermStat[] }[] = [];
  const centre = (rowCount - 1) / 2;
  for (let i = 0; i < rowCount; i++) {
    const d = Math.abs(i - centre) / (centre + 0.9);
    rows.push({ width: 0, cap: maxRowWidth * Math.sqrt(Math.max(0.1, 1 - d * d)), items: [] });
  }
  // Row order for placement: centre first, then alternating outward, so the
  // biggest terms (which arrive first) claim the middle of the cloud.
  const order = [...rows.keys()].sort((a, b) => Math.abs(a - centre) - Math.abs(b - centre));
  for (const t of terms) {
    const w = est(t);
    const target = order.find((i) => rows[i].width + w <= rows[i].cap) ?? order.reduce((a, b) => (rows[a].width / rows[a].cap <= rows[b].width / rows[b].cap ? a : b));
    rows[target].items.push(t);
    rows[target].width += w;
  }
  // Within each row, alternate around the middle so the largest bubble of the
  // row sits at its horizontal centre - the classic word-cloud read.
  return rows
    .filter((r) => r.items.length > 0)
    .map((r) => {
      const out: SearchTermStat[] = [];
      r.items.forEach((t, i) => (i % 2 === 0 ? out.push(t) : out.unshift(t)));
      return out;
    });
}

const dot = (c: string): React.CSSProperties => ({ width: 8, height: 8, borderRadius: "50%", background: c, display: "inline-block" });

export default function SearchPanel({ data }: { data: SearchAnalytics }) {
  const [active, setActive] = useState<Record<Outcome, boolean>>({ found: true, missed: true, suggest: true });
  const toggle = (o: Outcome) => setActive((a) => ({ ...a, [o]: !a[o] }));

  const cloudTerms = useMemo(() => data.terms.slice(0, 120), [data.terms]);
  const counts = useMemo(() => {
    const c: Record<Outcome, number> = { found: 0, missed: 0, suggest: 0 };
    for (const t of cloudTerms) c[outcomeOf(t)] += 1;
    return c;
  }, [cloudTerms]);

  const maxCount = Math.max(1, ...cloudTerms.map((t) => t.count));
  // sqrt scale keeps one runaway query from dwarfing everything else.
  const sizeFor = (count: number) => {
    const r = Math.sqrt(count / maxCount);
    return { font: 11 + Math.round(r * 11), pad: 6 + Math.round(r * 8) };
  };

  const rows = useMemo(() => {
    const visible = cloudTerms.filter((t) => active[outcomeOf(t)]).sort((a, b) => b.count - a.count);
    return cloudRows(visible, sizeFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudTerms, active, maxCount]);

  const bubbleStyle = (t: SearchTermStat): React.CSSProperties => {
    const { font, pad } = sizeFor(t.count);
    const p = PALETTE[outcomeOf(t)];
    return {
      fontSize: font, fontWeight: 600, lineHeight: 1,
      padding: `${pad}px ${pad + 6}px`, borderRadius: 999,
      background: p.bg, color: p.fg, border: `1px solid ${p.border}`,
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

      {/* ── Term cloud ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5, marginRight: 6 }}>What people search</span>
          <span style={{ fontSize: 12, color: "#8A93A6" }}>size = how often ·</span>
          {(Object.keys(PALETTE) as Outcome[]).map((o) => {
            const p = PALETTE[o];
            const on = active[o];
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                aria-pressed={on}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999,
                  background: on ? p.bg : "#fff", color: on ? p.fg : "#AEB6C4",
                  border: `1px solid ${on ? p.border : "#E0E4ED"}`,
                  opacity: on ? 1 : 0.75, transition: "all 0.12s ease",
                }}
              >
                <span style={{ ...dot(on ? p.dot : "#D6DAE2") }} />
                {p.label}
                <span style={{ fontWeight: 400, opacity: 0.8 }}>{counts[o]}</span>
              </button>
            );
          })}
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>
            {cloudTerms.length === 0 ? "No searches logged in this window yet." : "All colours filtered out - tap a legend chip to bring terms back."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 6 }}>
            {rows.map((row, i) => (
              <div key={i} style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8, maxWidth: "100%" }}>
                {row.map((t) => (
                  <span key={t.norm} style={bubbleStyle(t)} title={`${t.count}× · ${t.sessions} visitor${t.sessions === 1 ? "" : "s"} · ${t.maxResults >= 0 ? `best ${t.maxResults} results` : "outcome unmeasured"}${t.picks ? ` · ${t.picks} pick${t.picks === 1 ? "" : "s"}` : ""}`}>
                    {t.q}
                  </span>
                ))}
              </div>
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
                        ? <span style={{ color: "#C77700" }}>spelling · customers corrected to &ldquo;{t.correctedTo}&rdquo;</span>
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
