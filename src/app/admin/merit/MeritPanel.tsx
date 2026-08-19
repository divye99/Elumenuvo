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
};

const th: React.CSSProperties = { textAlign: "left", padding: "8px 9px", fontSize: 11, fontWeight: 700, color: "#56627A", borderBottom: "2px solid #E8EBF1", whiteSpace: "nowrap", position: "sticky", top: 0, background: "#fff" };
const td: React.CSSProperties = { padding: "7px 9px", fontSize: 12, borderBottom: "1px solid #EEF0F4", whiteSpace: "nowrap" };
const num = (v: number) => v.toFixed(2);
const chip = (bg: string, fg: string): React.CSSProperties => ({ fontSize: 10, fontWeight: 800, borderRadius: 6, padding: "2px 7px", background: bg, color: fg });

async function call(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/merit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: "Network hiccup" }));
  if (!j.ok) alert(j.error || "Failed");
  else window.location.reload();
}

export default function MeritPanel({ rows, promoterBrands, milestoneCr, paidGmv, milestoneReached }: {
  rows: MeritRow[];
  promoterBrands: string[];
  milestoneCr: number;
  paidGmv: number;
  milestoneReached: boolean;
}) {
  const [q, setQ] = useState("");
  const [view, setView] = useState<"all" | "explored" | "cooldown" | "overridden">("all");
  const [brandsText, setBrandsText] = useState(promoterBrands.join(", "));
  const [shown, setShown] = useState(100);

  const filtered = useMemo(() => {
    let list = rows;
    if (view === "explored") list = list.filter((r) => r.exploreShows > 0);
    if (view === "cooldown") list = list.filter((r) => r.cooldown);
    if (view === "overridden") list = list.filter((r) => r.override !== 0 || r.suppressed);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((r) => `${r.name} ${r.brand} ${r.id}`.toLowerCase().includes(needle));
    return list;
  }, [rows, q, view]);

  return (
    <div>
      {/* ── Engine config ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#8A93A6", letterSpacing: "0.7px", marginBottom: 8 }}>BRAND PROMOTER OF</div>
          <input value={brandsText} onChange={(e) => setBrandsText(e.target.value)} style={{ width: "100%", fontSize: 13, padding: "9px 11px", borderRadius: 9, border: "1px solid #E0E4ED" }} placeholder="Rajdhani, Wipro" />
          <div style={{ fontSize: 11, color: "#8A93A6", margin: "6px 0 10px" }}>
            Comma-separated. These brands get the (small) promoter term in EMS and first claim on the exploration slot.
          </div>
          <button onClick={() => call({ op: "config", promoterBrands: brandsText.split(",").map((s) => s.trim()).filter(Boolean), milestoneCr })} style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", background: "#4E5BDC", border: "none", borderRadius: 9, padding: "9px 16px", cursor: "pointer" }}>
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

      {/* ── Table controls ── */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product / brand / id…" style={{ fontSize: 13, padding: "9px 12px", borderRadius: 9, border: "1px solid #E0E4ED", minWidth: 260 }} />
        {(["all", "explored", "cooldown", "overridden"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ fontSize: 12, fontWeight: 700, padding: "7px 12px", borderRadius: 999, border: `1px solid ${view === v ? "#4E5BDC" : "#E0E4ED"}`, background: view === v ? "#4E5BDC" : "#fff", color: view === v ? "#fff" : "#3A4358", cursor: "pointer" }}>
            {v === "all" ? `All (${rows.length})` : v === "explored" ? "Explored 21d" : v === "cooldown" ? "In cooldown" : "Overridden"}
          </button>
        ))}
        <span style={{ fontSize: 12, color: "#8A93A6" }}>{filtered.length.toLocaleString("en-IN")} rows · sorted by EMS</span>
      </div>

      {/* ── The ranking, transparent ── */}
      <div style={{ overflowX: "auto", border: "1px solid #E8EBF1", borderRadius: 12, background: "#fff", maxHeight: 640, overflowY: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 1080 }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>EMS</th>
              <th style={th}>Velocity</th>
              <th style={th}>Pick</th>
              <th style={th}>Cart</th>
              <th style={th}>Buy 30d</th>
              <th style={th}>Review</th>
              <th style={th}>Value</th>
              <th style={th}>Flags</th>
              <th style={th}>Actions</th>
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
                <td style={td}>
                  {r.promoter > 0 && <span style={{ ...chip("#EEF0FE", "#4E5BDC"), marginRight: 4 }}>PROMOTER</span>}
                  {r.override !== 0 && <span style={{ ...chip("#FFF4E0", "#9A6B0F"), marginRight: 4 }}>{r.override > 0 ? "+" : ""}{r.override}</span>}
                  {r.suppressed && <span style={{ ...chip("#FDE8E8", "#B42318"), marginRight: 4 }}>SUPPRESSED</span>}
                  {r.cooldown && <span style={{ ...chip("#F3F5F9", "#56627A"), marginRight: 4 }}>COOLDOWN</span>}
                  {r.exploreShows > 0 && <span style={chip("#F2FBF6", "#137a4b")}>explored ×{r.exploreShows}</span>}
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
