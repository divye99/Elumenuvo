import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import type { MarketPoint } from "@/lib/competitor-history";

const OUR = "#4E5BDC";
const MARKET = "#E0612A"; // market-average line

/**
 * Price history · Elume vs the market. Shown for ALL products: the Elume price
 * over time, plus a blended "market average" line where we have competitor data
 * (aggregated server-side — never names or itemises the competitors). Public /
 * customer-facing.
 */
export default function CompetitorPriceChart({ series, mrp }: { series: MarketPoint[]; mrp?: number }) {
  const pts = series.filter((p) => p.our != null || p.marketAvg != null);
  if (pts.length === 0) return null;

  const hasMarket = pts.some((p) => p.marketAvg != null);
  const times = pts.map((p) => p.at);
  const ourByTime = new Map(pts.filter((p) => p.our != null).map((p) => [p.at, p.our as number]));
  const avgByTime = new Map(pts.filter((p) => p.marketAvg != null).map((p) => [p.at, p.marketAvg as number]));

  const allVals = [...ourByTime.values(), ...avgByTime.values(), mrp].filter((v): v is number => v != null);
  const lo = Math.min(...allVals) * 0.93;
  const hi = Math.max(...allVals) * 1.07;
  const W = 1000, H = 320, padX = 10, padY = 20;
  const x = (i: number) => (times.length <= 1 ? W / 2 : padX + (i / (times.length - 1)) * (W - padX * 2));
  const y = (v: number) => padY + (1 - (v - lo) / (hi - lo || 1)) * (H - padY * 2);
  const path = (m: Map<string, number>) => {
    const p = times.map((t, i) => { const v = m.get(t); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean);
    return p.length ? "M" + p.join(" L") : "";
  };
  const last = (m: Map<string, number>) => times.map((t) => m.get(t)).filter((v) => v != null).pop() ?? null;

  const latestOur = last(ourByTime);
  const latestAvg = last(avgByTime);
  const vsMarket = latestOur != null && latestAvg != null ? latestAvg - latestOur : null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 18, letterSpacing: "-0.4px" }}>Price history</div>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 3 }}>
            {hasMarket ? "Elume price vs the blended market average, comparable per unit." : "Elume price over time. Market comparison appears once we track this item."} Updated regularly.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#56627A", flexWrap: "wrap", alignItems: "center" }}>
          <Legend color={OUR} label="Elume" />
          {hasMarket && <Legend color={MARKET} label="Market avg" />}
          {mrp != null && <Legend color="#AEB6C4" label="MRP" dashed />}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)} style={{ stroke: "#EEF0F4", strokeWidth: "1px" }} />
        ))}
        {mrp != null && mrp >= lo && mrp <= hi && (
          <line x1="0" x2={W} y1={y(mrp)} y2={y(mrp)} style={{ stroke: "#AEB6C4", strokeWidth: "1.5px", strokeDasharray: "6 5" }} />
        )}
        {hasMarket && <path d={path(avgByTime)} style={{ fill: "none", stroke: MARKET, strokeWidth: "3px", strokeLinejoin: "round" }} />}
        <path d={path(ourByTime)} style={{ fill: "none", stroke: OUR, strokeWidth: "3px", strokeLinejoin: "round" }} />
        {latestOur != null && <circle cx={x(times.length - 1)} cy={y(latestOur)} r="5.5" style={{ fill: OUR, stroke: "#fff", strokeWidth: "2px" }} />}
        {hasMarket && latestAvg != null && <circle cx={x(times.length - 1)} cy={y(latestAvg)} r="5" style={{ fill: MARKET, stroke: "#fff", strokeWidth: "2px" }} />}
      </svg>

      {vsMarket != null && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: vsMarket >= 0 ? "#E6F5EE" : "#FBEDE4", borderRadius: 10, padding: "12px 16px", margin: "16px 0 0" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: vsMarket >= 0 ? "#137a4b" : "#9a3b16" }}>
            {vsMarket >= 0 ? <>You&apos;re <b>{fmt(vsMarket)} cheaper</b> than the market average</> : <>You&apos;re <b>{fmt(-vsMarket)} pricier</b> than the market average</>}
          </span>
          {latestAvg ? <span style={{ fontSize: 12.5, color: "#56627A" }}>{Math.round(Math.abs(vsMarket) / latestAvg * 100)}% {vsMarket >= 0 ? "below" : "above"}</span> : null}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${(hasMarket ? 1 : 0) + (mrp != null ? 1 : 0) + 1}, 1fr)`, gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F2F6" }}>
        <Stat label="Elume today" value={latestOur != null ? fmt(latestOur) : "—"} color={OUR} />
        {hasMarket && <Stat label="Market average" value={latestAvg != null ? fmt(latestAvg) : "—"} color={MARKET} />}
        {mrp != null && <Stat label="MRP" value={fmt(mrp)} color="#8A93A6" />}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: "#A0A7B5", marginTop: 8 }}>
        {times.length} price point{times.length === 1 ? "" : "s"}{hasMarket ? " · blended market average" : ""}
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
