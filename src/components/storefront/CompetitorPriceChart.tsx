"use client";

import { useMemo, useRef, useState } from "react";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import type { MarketPoint } from "@/lib/competitor-history";

const OUR = "#4E5BDC";
const MARKET = "#E0612A"; // avg-market line

/**
 * Price history · Elume vs the market, one point per day (daily snapshots via
 * migration 0048). Interactive: hovering (or touch-dragging) shows a crosshair
 * with the date, our price and the AVG market price across tracked sellers.
 * Competitors are aggregated server-side; the browser never sees who they are.
 */
export default function CompetitorPriceChart({ series, mrp }: { series: MarketPoint[]; mrp?: number }) {
  const pts = useMemo(() => series.filter((p) => p.our != null || p.marketAvg != null), [series]);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const hasMarket = pts.some((p) => p.marketAvg != null);
  const W = 1000, H = 320, padX = 14, padY = 22;

  const { x, y, lo, hi } = useMemo(() => {
    const vals = [...pts.flatMap((p) => [p.our, p.marketAvg]), mrp].filter((v): v is number => v != null);
    const lo = Math.min(...(vals.length ? vals : [0])) * 0.93;
    const hi = Math.max(...(vals.length ? vals : [1])) * 1.07;
    return {
      lo, hi,
      x: (i: number) => (pts.length <= 1 ? W / 2 : padX + (i / (pts.length - 1)) * (W - padX * 2)),
      y: (v: number) => padY + (1 - (v - lo) / (hi - lo || 1)) * (H - padY * 2),
    };
  }, [pts, mrp]);

  if (pts.length === 0) return null;

  const path = (pick: (p: MarketPoint) => number | null) => {
    const seg = pts.map((p, i) => { const v = pick(p); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean);
    return seg.length ? "M" + seg.join(" L") : "";
  };
  const lastOf = (pick: (p: MarketPoint) => number | null) => [...pts].reverse().map(pick).find((v) => v != null) ?? null;

  const latestOur = lastOf((p) => p.our);
  const latestAvg = lastOf((p) => p.marketAvg);
  const vsMarket = latestOur != null && latestAvg != null ? latestAvg - latestOur : null;

  const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  /* Map a pointer position to the nearest day index. */
  const locate = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = pts.length <= 1 ? 0 : Math.round(((px - padX) / (W - padX * 2)) * (pts.length - 1));
    setHover(Math.max(0, Math.min(pts.length - 1, i)));
  };

  const h = hover != null ? pts[hover] : null;
  // Tooltip flips sides near the right edge so it never clips.
  const tipLeftPct = hover != null ? (x(hover) / W) * 100 : 0;
  const tipFlip = tipLeftPct > 62;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 18, letterSpacing: "-0.4px" }}>Price history</div>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 3 }}>
            {hasMarket ? "Elume price vs the average market price across the sellers we track, logged daily." : "Elume price over time, logged daily. Market comparison appears once we track this item."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#56627A", flexWrap: "wrap", alignItems: "center" }}>
          <Legend color={OUR} label="Elume" />
          {hasMarket && <Legend color={MARKET} label="Avg market price" />}
          {mrp != null && <Legend color="#AEB6C4" label="MRP" dashed />}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair", touchAction: "pan-y" }}
          onMouseMove={(e) => locate(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => locate(e.touches[0].clientX)}
          onTouchMove={(e) => locate(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <line key={g} x1="0" x2={W} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)} style={{ stroke: "#EEF0F4", strokeWidth: "1px" }} />
          ))}
          {mrp != null && mrp >= lo && mrp <= hi && (
            <line x1="0" x2={W} y1={y(mrp)} y2={y(mrp)} style={{ stroke: "#AEB6C4", strokeWidth: "1.5px", strokeDasharray: "6 5" }} />
          )}
          {hasMarket && <path d={path((p) => p.marketAvg)} style={{ fill: "none", stroke: MARKET, strokeWidth: "3px", strokeLinejoin: "round" }} />}
          <path d={path((p) => p.our)} style={{ fill: "none", stroke: OUR, strokeWidth: "3px", strokeLinejoin: "round" }} />

          {/* Crosshair + markers under the pointer */}
          {h && (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={padY - 6} y2={H - padY + 6} style={{ stroke: "#C3C9D6", strokeWidth: "1.5px", strokeDasharray: "4 4" }} />
              {h.our != null && <circle cx={x(hover!)} cy={y(h.our)} r="6" style={{ fill: OUR, stroke: "#fff", strokeWidth: "2.5px" }} />}
              {h.marketAvg != null && <circle cx={x(hover!)} cy={y(h.marketAvg)} r="5.5" style={{ fill: MARKET, stroke: "#fff", strokeWidth: "2.5px" }} />}
            </g>
          )}
          {!h && latestOur != null && <circle cx={x(pts.length - 1)} cy={y(latestOur)} r="5.5" style={{ fill: OUR, stroke: "#fff", strokeWidth: "2px" }} />}
          {!h && hasMarket && latestAvg != null && <circle cx={x(pts.length - 1)} cy={y(latestAvg)} r="5" style={{ fill: MARKET, stroke: "#fff", strokeWidth: "2px" }} />}
        </svg>

        {/* Tooltip */}
        {h && (
          <div style={{ position: "absolute", top: 8, left: `${tipLeftPct}%`, transform: tipFlip ? "translateX(calc(-100% - 14px))" : "translateX(14px)", background: "#19202E", color: "#fff", borderRadius: 10, padding: "9px 12px", pointerEvents: "none", boxShadow: "0 10px 26px rgba(20,24,45,.25)", whiteSpace: "nowrap", zIndex: 5 }}>
            <div style={{ fontSize: 11, color: "#AEB6C4", marginBottom: 4 }}>{fmtDay(h.at)}</div>
            {h.our != null && <div style={{ fontSize: 12.5, fontWeight: 700 }}><span style={{ color: "#9BA6F5" }}>Elume</span> {fmt(h.our)}</div>}
            {h.marketAvg != null && <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 2 }}><span style={{ color: "#F0A484" }}>Avg market</span> {fmt(h.marketAvg)}</div>}
            {h.our != null && h.marketAvg != null && (
              <div style={{ fontSize: 11, marginTop: 4, color: h.marketAvg >= h.our ? "#7FDCAB" : "#F5B09A" }}>
                {h.marketAvg >= h.our ? `${fmt(h.marketAvg - h.our)} below market` : `${fmt(h.our - h.marketAvg)} above market`}
              </div>
            )}
          </div>
        )}
      </div>

      {/* X-axis: first / middle / last day */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10.5, color: "#A0A7B5", marginTop: 6 }}>
        <span>{fmtDay(pts[0].at)}</span>
        {pts.length > 2 && <span>{fmtDay(pts[Math.floor((pts.length - 1) / 2)].at)}</span>}
        {pts.length > 1 && <span>{fmtDay(pts[pts.length - 1].at)}</span>}
      </div>

      {vsMarket != null && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: vsMarket >= 0 ? "#E6F5EE" : "#FBEDE4", borderRadius: 10, padding: "12px 16px", margin: "16px 0 0" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: vsMarket >= 0 ? "#137a4b" : "#9a3b16" }}>
            {vsMarket >= 0 ? <>You&apos;re <b>{fmt(vsMarket)} cheaper</b> than the average market price</> : <>You&apos;re <b>{fmt(-vsMarket)} pricier</b> than the average market price</>}
          </span>
          {latestAvg ? <span style={{ fontSize: 12.5, color: "#56627A" }}>{Math.round(Math.abs(vsMarket) / latestAvg * 100)}% {vsMarket >= 0 ? "below" : "above"}</span> : null}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${(hasMarket ? 1 : 0) + (mrp != null ? 1 : 0) + 1}, 1fr)`, gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F2F6" }}>
        <Stat label="Elume today" value={latestOur != null ? fmt(latestOur) : "–"} color={OUR} />
        {hasMarket && <Stat label="Avg market price" value={latestAvg != null ? fmt(latestAvg) : "–"} color={MARKET} />}
        {mrp != null && <Stat label="MRP" value={fmt(mrp)} color="#8A93A6" />}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: "#A0A7B5", marginTop: 8 }}>
        {pts.length} day{pts.length === 1 ? "" : "s"} of price data · logged daily{hasMarket ? " · market = average across tracked sellers" : ""}
      </div>
    </div>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 16, height: dashed ? 0 : 3, borderRadius: 2, background: dashed ? undefined : color, borderTop: dashed ? `2px dashed ${color}` : undefined, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 18, fontWeight: 600, color: color ?? "#19202E" }}>{value}</div>
    </div>
  );
}
