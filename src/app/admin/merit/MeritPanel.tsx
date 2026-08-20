"use client";

import { useMemo, useState } from "react";

/** The behind-the-scenes view of the Elume Merit Score engine (owner ask:
 *  "see the ranking, cooldowns, exploratory ones, and intervene manually").
 *  Everything here mirrors exactly what the storefront ranker uses. */

export type MeritRow = {
  id: string;
  name: string;
  brand: string;
  cat: string;
  ems: number;
  velocity: number;
  pickRate: number;
  cartRate: number;
  buyRate: number;
  review: number;
  value: number;
  promoter: number;
  override: number;
  suppressed: boolean;
  cooldown: boolean;
  exploreShows: number;
  explorePicks: number;
  explorePickRate: number;
};

const th: React.CSSProperties = { textAlign: "left", padding: "8px 9px", fontSize: 11, fontWeight: 700, color: "#56627A", borderBottom: "2px solid #E8EBF1", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#fff" };
const td: React.CSSProperties = { padding: "7px 9px", fontSize: 12, borderBottom: "1px solid #EEF0F4", whiteSpace: "nowrap" };
const num = (v: number) => v.toFixed(2);
const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px", background: bg, color: fg });

function Info({ tip }: { tip: string }) {
  return <span className="mtip" onClick={(e) => e.stopPropagation()}>ⓘ<span className="mtipbox">{tip}</span></span>;
}

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/merit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: "Network hiccup" }));
  if (!j.ok) alert(j.error || "Failed");
  else window.location.reload();
}

/** Column headers with their hover explanations (owner ask: a small info
 *  cloud per header, brief, with the maths where there is any). */
const NUMERIC_COLS: [key: string, label: string, tip: string][] = [
  ["ems", "EMS", "Elume Merit Score = 0.6 x Demand + 0.3 x Reviews + 0.1 x Value, + 0.06 if Brand Promoter, + any manual boost. Breaks ties in featured ordering."],
  ["velocity", "Velocity", "PDP glance views per day live, smoothed toward the category average, squashed to 0-1. 0.50 = exactly category average."],
  ["pickRate", "Pick", "Search picks (result clicks) per view, smoothed vs category with a 25-view prior, squashed to 0-1. 0.50 = par."],
  ["cartRate", "Cart", "Cart adds per glance view over 30 days, smoothed vs category (25-view prior), squashed to 0-1. 0.50 = par."],
  ["buyRate", "Buy 30d", "Units bought per glance view, last 30 days, smoothed and squashed. Lightest demand weight today; flips to heaviest at Rs 10 Cr paid GMV."],
  ["review", "Review", "Average stars smoothed toward the category average with a 5-review prior, squashed to 0-1. 0.50 = par (few or no reviews)."],
  ["value", "Value", "(1 + savings vs MRP + 0.3 if at/below tracked market low) / (2 + the same). 0.50 = no discount; deeper savings push higher."],
  ["exploreShows", "Explored Impr.", "Times the search wildcard slot SHOWED this product in the rolling last 21 days. An impression, not a click; does not change EMS."],
  ["explorePickRate", "Explore PR", "Picks earned on the same queries where it held the wildcard slot, over those impressions. 8+ impressions with zero picks = automatic temporary cooldown."],
];
type SortKey = string;

export default function MeritPanel({ rows, promoterBrands, milestoneCr, paidGmv, milestoneReached, promoterExploreEdge }: {
  rows: MeritRow[];
  promoterBrands: string[];
  milestoneCr: number;
  paidGmv: number;
  milestoneReached: boolean;
  promoterExploreEdge: number;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "explored" | "cooldown" | "overridden">("all");
  const [cat, setCat] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ems");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [showCats, setShowCats] = useState(false);
  const [brandsText, setBrandsText] = useState(promoterBrands.join(", "));
  const [edgePct, setEdgePct] = useState(String(Math.round(promoterExploreEdge * 100)));
  const [shown, setShown] = useState(100);

  const cats = useMemo(() => [...new Set(rows.map((r) => r.cat))].sort(), [rows]);
  const rowBrands = useMemo(() => [...new Set(rows.map((r) => r.brand))].sort(), [rows]);

  // Click a numeric header to sort by it: first click = highest first
  // (down arrow), second click flips to lowest first.
  const onSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    let list = rows;
    if (view === "explored") list = list.filter((r) => r.exploreShows > 0);
    if (view === "cooldown") list = list.filter((r) => r.cooldown);
    if (view === "overridden") list = list.filter((r) => r.override !== 0 || r.suppressed);
    if (cat) list = list.filter((r) => r.cat === cat);
    if (brandFilter) list = list.filter((r) => r.brand === brandFilter);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((r) => `${r.name} ${r.brand} ${r.id}`.toLowerCase().includes(needle));
    const dir = sortDir === "desc" ? -1 : 1;
    return [...list].sort((a, b) => dir * ((Number((a as any)[sortKey]) || 0) - (Number((b as any)[sortKey]) || 0)));
  }, [rows, q, view, cat, brandFilter, sortKey, sortDir]);

  return (
    <div>
      {/* ── Engine config ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8A93A6", letterSpacing: "0.7px", marginBottom: 8 }}>BRAND PROMOTER OF</div>
          <input value={brandsText} onChange={(e) => setBrandsText(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "9px 11px", borderRadius: 9, border: "1px solid #E0E4ED" }} placeholder="Rajdhani, Wipro" />
          <div style={{ fontSize: 11, color: "#8A93A6", margin: "6px 0 10px" }}>
            Comma-separated. These brands get the (small) promoter term in EMS and a weighted preference in the exploration slot.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
            <span style={{ fontSize: 12, color: "#3A4358", fontWeight: 600 }}>Exploration edge</span>
            <input value={edgePct} onChange={(e) => setEdgePct(e.target.value)} inputMode="numeric" style={{ width: 64, fontSize: 13, padding: "7px 9px", borderRadius: 8, border: "1px solid #E0E4ED", textAlign: "right" }} />
            <span style={{ fontSize: 12, color: "#8A93A6" }}>% extra lottery tickets a promoter product holds in the exploration slot (everyone else holds 1 ticket)</span>
          </div>
          <button onClick={() => call({ op: "config", promoterBrands: brandsText.split(",").map((s) => s.trim()).filter(Boolean), milestoneCr, promoterExploreEdge: Math.min(200, Math.max(0, Number(edgePct) || 20)) / 100 })} style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", background: "#4E5BDC", border: "none", borderRadius: 9, padding: "9px 16px", cursor: "pointer" }}>
            Save config
          </button>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8A93A6", letterSpacing: "0.7px", marginBottom: 8 }}>PURCHASE-WEIGHT MILESTONE</div>
          <div style={{ fontSize: 13.5, color: "#19202E", lineHeight: 1.6 }}>
            Paid GMV so far: <b>₹{Math.round(paidGmv).toLocaleString("en-IN")}</b> of ₹{(milestoneCr * 1_00_00_000).toLocaleString("en-IN")} ({milestoneCr} Cr)
            <div style={{ marginTop: 6 }}>
              Buy-rate weighting: {milestoneReached
                ? <span style={chip("#E6F5EE", "#137a4b")}>SCALED (heaviest, 45% of demand)</span>
                : <span style={chip("#FFF4E0", "#9A6B0F")}>EARLY (lightest, 10% of demand)</span>}
              <span style={{ fontSize: 11.5, color: "#8A93A6", marginLeft: 8 }}>flips automatically at the milestone</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category averages: the number the owner reads - average EMS ── */}
      <div style={{ marginBottom: 14 }}>
        <button onClick={() => setShowCats((v) => !v)} style={{ fontSize: 12.5, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FE", border: "none", borderRadius: 9, padding: "8px 14px", cursor: "pointer" }}>
          {showCats ? "Hide category averages" : "Show category averages"}
        </button>
        {showCats && (
          <div style={{ marginTop: 10, overflowX: "auto", border: "1px solid #E8EBF1", borderRadius: 12, background: "#fff", maxWidth: 560 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr>
                {["Category", "Products", "Average EMS"].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(() => {
                  const agg = new Map<string, { n: number; sum: number }>();
                  for (const r of rows) {
                    const a = agg.get(r.cat) ?? { n: 0, sum: 0 };
                    a.n += 1; a.sum += r.ems;
                    agg.set(r.cat, a);
                  }
                  return [...agg.entries()]
                    .map(([name, a]) => ({ name, n: a.n, avg: a.sum / a.n }))
                    .sort((x, y) => y.avg - x.avg)
                    .map((c) => (
                      <tr key={c.name} style={{ background: cat === c.name ? "#F3F7FF" : undefined }}>
                        <td style={{ ...td, fontWeight: 700 }}>{c.name}</td>
                        <td style={td}>{c.n.toLocaleString("en-IN")}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{c.avg.toFixed(3)}</td>
                      </tr>
                    ));
                })()}
              </tbody>
            </table>
            <div style={{ padding: "9px 12px", fontSize: 11, color: "#8A93A6" }}>
              Mean EMS across every product in the category. A value near 0.45-0.50 means mostly at-par products with little data yet; higher means real demand is concentrating there.
            </div>
          </div>
        )}
      </div>

      {/* ── Table controls ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product / brand / id…" style={{ fontSize: 13, padding: "9px 12px", borderRadius: 9, border: "1px solid #E0E4ED", minWidth: 240 }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: 9, border: "1px solid #E0E4ED", background: "#fff" }}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: 9, border: "1px solid #E0E4ED", background: "#fff" }}>
          <option value="">All brands</option>
          {rowBrands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        {(["all", "explored", "cooldown", "overridden"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 999, border: `1px solid ${view === v ? "#4E5BDC" : "#E0E4ED"}`, background: view === v ? "#4E5BDC" : "#fff", color: view === v ? "#fff" : "#3A4358", cursor: "pointer" }}>
            {v === "all" ? `All (${rows.length})` : v === "explored" ? "Explored (last 21 days)" : v === "cooldown" ? "In cooldown" : "Overridden"}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#8A93A6" }}>{filtered.length.toLocaleString("en-IN")} rows</span>
      </div>

      {/* ── The ranking, transparent. Click a numeric header to sort;
             hover the i for the definition and maths. ── */}
      <style>{`
        .mtip { position: relative; display: inline-block; margin-left: 4px; color: #A0A7B5; font-weight: 400; cursor: help; }
        .mtip .mtipbox { display: none; position: absolute; z-index: 40; top: 130%; left: -8px; width: 240px;
          background: #161D2B; color: #fff; font-size: 11px; font-weight: 400; line-height: 1.45;
          padding: 8px 11px; border-radius: 9px; white-space: normal; text-transform: none; letter-spacing: normal; }
        .mtip:hover .mtipbox { display: block; }
        th:nth-last-child(-n+3) .mtip .mtipbox { left: auto; right: -8px; }
      `}</style>
      <div style={{ overflowX: "auto", border: "1px solid #E8EBF1", borderRadius: 12, background: "#fff", maxHeight: 640, overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1220 }}>
          <thead>
            <tr>
              <th style={th}>Product<Info tip="Name, brand, category and product id. Click a name to open its live product page." /></th>
              {NUMERIC_COLS.map(([key, label, tip]) => (
                <th key={key} style={{ ...th, cursor: "pointer", userSelect: "none", color: sortKey === key ? "#4E5BDC" : th.color }} onClick={() => onSort(key)}>
                  {label}{sortKey === key ? (sortDir === "desc" ? " ▼" : " ▲") : ""}<Info tip={tip} />
                </th>
              ))}
              <th style={th}>Flags<Info tip="PROMOTER = Brand Promoter term active. SUPPRESSED = pinned to the bottom of featured ordering. COOLDOWN = wildcard exploration paused (always temporary)." /></th>
              <th style={th}>Actions<Info tip="Manual interventions: additive boost on EMS, hard suppression, or a temporary exploration cooldown. Every change takes effect within 5 minutes." /></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, shown).map((r) => (
              <tr key={r.id} style={{ background: r.suppressed ? "#FDF2F2" : undefined }}>
                <td style={{ ...td, whiteSpace: "normal", minWidth: 260 }}>
                  <a href={`/catalogue/${r.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, color: "#19202E" }}>{r.name}</a>
                  <div style={{ fontSize: 10.5, color: "#8A93A6" }}>{r.brand} · {r.cat} · {r.id}</div>
                </td>
                <td style={{ ...td, fontWeight: 800, color: r.ems < 0 ? "#C2410C" : "#19202E" }}>{num(r.ems)}</td>
                <td style={td}>{num(r.velocity)}</td>
                <td style={td}>{num(r.pickRate)}</td>
                <td style={td}>{num(r.cartRate)}</td>
                <td style={td}>{num(r.buyRate)}</td>
                <td style={td}>{num(r.review)}</td>
                <td style={td}>{num(r.value)}</td>
                <td style={{ ...td, fontWeight: r.exploreShows ? 700 : 400, color: r.exploreShows ? "#137a4b" : "#A0A7B5" }}>{r.exploreShows || "-"}</td>
                <td style={{ ...td, fontWeight: r.exploreShows ? 700 : 400, color: r.explorePickRate > 0 ? "#137a4b" : r.exploreShows ? "#B7791F" : "#A0A7B5" }}>
                  {r.exploreShows ? `${Math.round(r.explorePickRate * 100)}%` : "-"}
                </td>
                <td style={td}>
                  {r.promoter > 0 && <span style={{ ...chip("#EEF0FE", "#4E5BDC"), marginRight: 4 }}>PROMOTER</span>}
                  {r.override !== 0 && <span style={{ ...chip("#FFF4E0", "#9A6B0F"), marginRight: 4 }}>{r.override > 0 ? "+" : ""}{r.override}</span>}
                  {r.suppressed && <span style={{ ...chip("#FDE8E8", "#B42318"), marginRight: 4 }}>SUPPRESSED</span>}
                  {r.cooldown && <span style={chip("#F3F5F9", "#56627A")}>COOLDOWN</span>}
                </td>
                <td style={td}>
                  <button onClick={() => { const v = prompt("Boost (e.g. 0.2, -0.3, 0 to clear):", String(r.override)); if (v !== null) call({ op: "override", productId: r.id, boost: Number(v) || 0, suppressed: r.suppressed, note: prompt("Note (why):") || undefined }); }} style={mini}>boost</button>
                  <button onClick={() => call({ op: "override", productId: r.id, boost: r.override, suppressed: !r.suppressed, note: r.suppressed ? "unsuppressed" : prompt("Suppress note (why):") || "manual" })} style={mini}>{r.suppressed ? "unsuppress" : "suppress"}</button>
                  {r.cooldown
                    ? <button onClick={() => call({ op: "cooldown", productId: r.id, days: 0 })} style={mini}>clear cooldown</button>
                    : <button onClick={() => { const d = prompt("Cooldown days (temporary, max 90):", "21"); if (d) call({ op: "cooldown", productId: r.id, days: Number(d) || 21 }); }} style={mini}>cooldown</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > shown && (
        <button onClick={() => setShown((n) => n + 200)} style={{ marginTop: 12, fontSize: 12.5, fontWeight: 700, color: "#19202E", background: "#fff", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 18px", cursor: "pointer" }}>
          Show more · {filtered.length - shown} left
        </button>
      )}
    </div>
  );
}

const mini: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#4E5BDC", background: "#F3F5F9", border: "none", borderRadius: 7, padding: "5px 9px", marginRight: 5, cursor: "pointer" };
