/**
 * Elume rating — a single star + the numeric score (e.g. ★ 4.5), with an
 * optional review count. Compact and number-first.
 */

const STAR = "#F5A623";
const OFF = "#D9DEE8";

export function Star({ size = 13, color = STAR }: { size?: number; color?: string }) {
  return <span style={{ fontSize: size, color, lineHeight: 1, display: "inline-block" }}>★</span>;
}

/** ★ 4.5 (12) */
export default function Rating({ rating, count, size = 13 }: { rating: number; count?: number; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }} title={`${rating.toFixed(1)} out of 5`}>
      <Star size={size + 2} />
      <span style={{ fontSize: size, fontWeight: 700, color: "#3A4358" }}>{rating.toFixed(1)}</span>
      {count !== undefined && <span style={{ fontSize: size - 1, color: "#8A93A6" }}>({count})</span>}
    </span>
  );
}

/** Interactive 1–5 star picker (review form). */
export function StarInput({ value, hover, size = 26, onSet, onHover }: { value: number; hover: number; size?: number; onSet: (n: number) => void; onHover: (n: number) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSet(i)}
          onMouseEnter={() => onHover(i)}
          onMouseLeave={() => onHover(0)}
          aria-label={`${i} star${i > 1 ? "s" : ""}`}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}
        >
          <Star size={size} color={i <= (hover || value) ? STAR : OFF} />
        </button>
      ))}
    </span>
  );
}
