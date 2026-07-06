import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import type { CompetitorPoint } from "@/lib/competitor-history";

const SOURCE_LABEL: Record<string, string> = { vashi: "Vashi", amazon: "Amazon", moglix: "Moglix" };
const SOURCE_COLOR: Record<string, string> = { vashi: "#E0612A", amazon: "#C5841C", moglix: "#7B5BDC" };

/**
 * Per-product price comparison — our Elume price vs tracked competitors over
 * time, from real competitor_price_history captured each monthly sync. Renders
 * nothing until there's data, so it's safe to always mount.
 */
export default function CompetitorPriceChart({ points }: { points: CompetitorPoint[] }) {
  if (points.length === 0) return null;

  const sources = Array.from(new Set(points.map((p) => p.source)));
  const times = Array.from(new Set(points.map((p) => p.at))).sort();
  // Series: our price + one comparable line per source, indexed by capture time.
  const ourByTime = new Map(points.filter((p) => p.our != null).map((p) => [p.at, p.our as number]));
  const compByTime: Record<string, Map<string, number>> = {};
  for (const s of sources) compByTime[s] = new Map(points.filter((p) => p.source === s && p.comparable != null).map((p) => [p.at, p.comparable as number]));

  const allVals = points.flatMap((p) => [p.comparable, p.our]).filter((v): v is number => v != null);
  const min = Math.min(...allVals) * 0.95;
  const max = Math.max(...allVals) * 1.05;
  const W = 860, H = 240, padX = 8, padY = 16;
  const x = (i: number) => (times.length <= 1 ? W / 2 : padX + (i / (times.length - 1)) * (W - padX * 2));
  const y = (v: number) => padY + (1 - (v - min) / (max - min || 1)) * (H - padY * 2);
  const path = (get: (t: string) => number | undefined) => {
    const pts = times.map((t, i) => { const v = get(t); return v == null ? null : `${x(i)},${y(v)}`; }).filter(Boolean);
    return pts.length ? "M" + pts.join(" L") : "";
  };

  const latestComp = (s: string) => { const m = compByTime[s]; return times.map((t) => m.get(t)).filter((v) => v != null).pop() ?? null; };
  const latestOur = times.map((t) => ourByTime.get(t)).filter((v) => v != null).pop() ?? null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15 }}>Price vs competitors</div>
          <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 2 }}>Elume price vs tracked competitor prices, comparable per unit. Updated monthly.</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: "#56627A", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 15, height: 3, borderRadius: 2, background: "#4E5BDC", display: "inline-block" }} />Elume</span>
          {sources.map((s) => (
            <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 15, height: 3, borderRadius: 2, background: SOURCE_COLOR[s] ?? "#8A93A6", display: "inline-block" }} />{SOURCE_LABEL[s] ?? s}</span>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1="0" x2={W} y1={padY + g * (H - padY * 2)} y2={padY + g * (H - padY * 2)} style={{ stroke: "#EEF0F4", strokeWidth: "1px" }} />
        ))}
        {sources.map((s) => (
          <path key={s} d={path((t) => compByTime[s].get(t))} style={{ fill: "none", stroke: SOURCE_COLOR[s] ?? "#8A93A6", strokeWidth: "2px", strokeLinejoin: "round" }} />
        ))}
        <path d={path((t) => ourByTime.get(t))} style={{ fill: "none", stroke: "#4E5BDC", strokeWidth: "2.5px", strokeLinejoin: "round" }} />
        {/* endpoint dots */}
        {times.length > 0 && latestOur != null && <circle cx={x(times.length - 1)} cy={y(latestOur)} r="4.5" style={{ fill: "#4E5BDC", stroke: "#fff", strokeWidth: "2px" }} />}
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${sources.length + 1}, 1fr)`, gap: 12, marginTop: 16, paddingTop: 16, borderTop: "1px solid #F0F2F6" }}>
        <Stat label="Elume today" value={latestOur != null ? fmt(latestOur) : "—"} color="#4E5BDC" />
        {sources.map((s) => {
          const c = latestComp(s);
          const cheaper = c != null && latestOur != null && latestOur < c;
          return <Stat key={s} label={`${SOURCE_LABEL[s] ?? s} (comparable)`} value={c != null ? fmt(c) : "—"} color={SOURCE_COLOR[s]} sub={c != null && latestOur != null ? (cheaper ? `we're ${fmt(c - latestOur)} lower` : `we're ${fmt(latestOur - c)} higher`) : undefined} />;
        })}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: "#A0A7B5", marginTop: 8 }}>{times.length} data point{times.length === 1 ? "" : "s"} · comparable = competitor price × unit factor</div>
    </div>
  );
}

function Stat({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: color ?? "#19202E" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#1F9D63", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
