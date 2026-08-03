"use client";

import { useMemo, useState } from "react";
import type { RatePoint } from "@/lib/metals-history";

/**
 * Our copper selling-rate chart: ex-GST ₹/kg over 24h / 7D / 1M / 3M / 6M /
 * 1Y / 5Y, with the change (value + %) across the selected window. Step-line,
 * because the rate moves in discrete console updates (2-3x/day), not ticks.
 * Data = the product's full price_history (public-read), converted from the
 * stored GST-inclusive unit price to the trade-facing ex-GST ₹/kg rate.
 */
const RANGES: { key: string; label: string; ms: number }[] = [
  { key: "24h", label: "24H", ms: 24 * 3600_000 },
  { key: "7d", label: "7D", ms: 7 * 86400_000 },
  { key: "1m", label: "1M", ms: 30 * 86400_000 },
  { key: "3m", label: "3M", ms: 91 * 86400_000 },
  { key: "6m", label: "6M", ms: 182 * 86400_000 },
  { key: "1y", label: "1Y", ms: 365 * 86400_000 },
  { key: "5y", label: "5Y", ms: 5 * 365 * 86400_000 },
];

const W = 1000;
const H = 300;
const PAD = { l: 64, r: 18, t: 14, b: 30 };

export default function MetalsRateChart({
  points,
  gstRate,
  kgPerUnit,
}: {
  points: RatePoint[];
  gstRate: number;
  kgPerUnit: number;
}) {
  const [range, setRange] = useState("1m");
  const [hover, setHover] = useState<number | null>(null);

  // Stored unit price → ex-GST ₹/kg (the number the trade quotes).
  const rates = useMemo(
    () =>
      points
        .map((p) => ({ t: new Date(p.at).getTime(), rate: p.price / (1 + gstRate) / kgPerUnit }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.rate))
        .sort((a, b) => a.t - b.t),
    [points, gstRate, kgPerUnit]
  );

  const view = useMemo(() => {
    const r = RANGES.find((x) => x.key === range) ?? RANGES[2];
    const cutoff = Date.now() - r.ms;
    const inWindow = rates.filter((p) => p.t >= cutoff);
    // Carry the last pre-window rate in as the opening point, so a quiet
    // window still shows a line and the change is measured from the rate
    // that was actually in force when the window opened.
    const prior = rates.filter((p) => p.t < cutoff);
    const carried = prior.length ? [{ t: cutoff, rate: prior[prior.length - 1].rate }, ...inWindow] : inWindow;
    return carried;
  }, [rates, range]);

  if (rates.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "26px 28px", fontSize: 13.5, color: "#56627A" }}>
        Rate history starts building from the first price update - check back shortly.
      </div>
    );
  }

  const last = view[view.length - 1] ?? rates[rates.length - 1];
  const first = view[0] ?? last;
  const change = last.rate - first.rate;
  const changePct = first.rate > 0 ? (change / first.rate) * 100 : 0;
  const up = change >= 0;
  const hi = Math.max(...view.map((p) => p.rate));
  const lo = Math.min(...view.map((p) => p.rate));

  // Scales with a little headroom; a flat series still gets a visible band.
  const span = Math.max(hi - lo, Math.max(hi * 0.004, 1));
  const yTop = hi + span * 0.18;
  const yBot = Math.max(0, lo - span * 0.18);
  const t0 = first.t;
  const t1 = Math.max(last.t, t0 + 1);
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((yTop - v) / (yTop - yBot)) * (H - PAD.t - PAD.b);

  // Step-after path: the rate holds until the next console update.
  let d = "";
  view.forEach((p, i) => {
    const px = x(p.t);
    const py = y(p.rate);
    d += i === 0 ? `M ${px} ${py}` : ` H ${px} V ${py}`;
  });
  d += ` H ${x(t1)}`;

  const gridYs = [0.25, 0.5, 0.75].map((f) => yBot + (yTop - yBot) * f);
  const hovered = hover != null ? view[hover] : null;

  const fmtRate = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtWhen = (t: number) =>
    new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", ...(range === "24h" || range === "7d" ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(t));

  return (
    <div data-pdp-sec="rate-chart" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Our selling rate</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--space-grotesk)", fontSize: 26, fontWeight: 600, letterSpacing: "-0.6px", color: "#19202E" }}>
              {fmtRate(last.rate)}<span style={{ fontSize: 13, color: "#8A93A6", fontWeight: 500 }}>/kg ex-GST</span>
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: up ? "#1F9D63" : "#D14343" }}>
              {up ? "▲" : "▼"} {fmtRate(Math.abs(change)).slice(1)} ({Math.abs(changePct).toFixed(2)}%)
            </span>
            <span style={{ fontSize: 11.5, color: "#8A93A6" }}>over {RANGES.find((r) => r.key === range)?.label}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 10, padding: 3 }}>
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => { setRange(r.key); setHover(null); }}
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: "5px 9px",
                borderRadius: 8,
                border: "none",
                cursor: "pointer",
                color: range === r.key ? "#fff" : "#56627A",
                background: range === r.key ? "#4E5BDC" : "transparent",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", touchAction: "pan-y" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          let bestD = Infinity;
          view.forEach((p, i) => {
            const dd = Math.abs(x(p.t) - mx);
            if (dd < bestD) { bestD = dd; best = i; }
          });
          setHover(best);
        }}
      >
        {gridYs.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#F0F2F6" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="#A0A7B5">
              {Math.round(v).toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#E8EBF1" strokeWidth={1} />
        <text x={PAD.l} y={H - 8} fontSize={11} fill="#A0A7B5">{fmtWhen(t0)}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize={11} fill="#A0A7B5">{fmtWhen(t1)}</text>

        {/* area fill under the step line */}
        <path d={`${d} V ${y(yBot)} H ${x(t0)} Z`} fill={up ? "rgba(31,157,99,0.07)" : "rgba(209,67,67,0.06)"} stroke="none" />
        <path d={d} fill="none" stroke={up ? "#1F9D63" : "#D14343"} strokeWidth={2.4} strokeLinejoin="round" />

        {hovered && (
          <g>
            <line x1={x(hovered.t)} x2={x(hovered.t)} y1={PAD.t} y2={H - PAD.b} stroke="#C7CEDC" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hovered.t)} cy={y(hovered.rate)} r={4.5} fill="#fff" stroke={up ? "#1F9D63" : "#D14343"} strokeWidth={2.4} />
          </g>
        )}
      </svg>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 10, fontSize: 12, color: "#56627A" }}>
        {hovered ? (
          <span><b style={{ color: "#19202E" }}>{fmtRate(hovered.rate)}/kg</b> · {fmtWhen(hovered.t)} IST</span>
        ) : (
          <>
            <span>High <b style={{ color: "#19202E" }}>{fmtRate(hi)}</b></span>
            <span>Low <b style={{ color: "#19202E" }}>{fmtRate(lo)}</b></span>
            <span>Updates land at ~9:00 am, 11:00 am and 2:00 pm IST on trading days</span>
          </>
        )}
      </div>
    </div>
  );
}
