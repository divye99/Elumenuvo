/**
 * The Elume "volt rating" — lightning bolts instead of stars (we're an
 * electricals house). 0–5 bolts with proportional fill; shown on catalogue
 * cards, detail pages and reviews.
 */

const BOLT_PATH = "M6.5 0 L0 9.5 H4 L3 16 L11 6 H6.5 Z";
const VOLT = "#F4B400"; // electric amber
const OFF = "#D9DEE8";

export function Bolt({ size = 13, color = VOLT }: { size?: number; color?: string }) {
  return (
    <svg width={size * 0.72} height={size} viewBox="0 0 11 16" style={{ display: "block" }}>
      <path d={BOLT_PATH} fill={color} />
    </svg>
  );
}

function BoltRow({ size, color }: { size: number; color: string }) {
  return (
    <span style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Bolt key={i} size={size} color={color} />
      ))}
    </span>
  );
}

/** ⚡⚡⚡⚡⚡ 4.3 (12) — proportional fill via a clipped overlay. */
export default function Rating({
  rating,
  count,
  size = 13,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }} title={`Volt rating ${rating.toFixed(1)}/5`}>
      <span style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
        <BoltRow size={size} color={OFF} />
        <span style={{ position: "absolute", inset: 0, width: `${pct}%`, overflow: "hidden" }}>
          <BoltRow size={size} color={VOLT} />
        </span>
      </span>
      <span style={{ fontSize: size - 1, fontWeight: 700, color: "#3A4358" }}>{rating.toFixed(1)}</span>
      {count !== undefined && <span style={{ fontSize: size - 1, color: "#8A93A6" }}>({count})</span>}
    </span>
  );
}
