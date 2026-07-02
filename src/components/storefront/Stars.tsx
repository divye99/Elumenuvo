/** Compact star-rating row: ★★★★☆ 4.3 (12). Pure presentational. */
export default function Stars({
  rating,
  count,
  size = 13,
}: {
  rating: number;
  count?: number;
  size?: number;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: size, letterSpacing: 1, lineHeight: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ color: i <= Math.round(rating) ? "#F5A623" : "#D9DEE8" }}>
            ★
          </span>
        ))}
      </span>
      <span style={{ fontSize: size - 1, fontWeight: 700, color: "#3A4358" }}>{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span style={{ fontSize: size - 1, color: "#8A93A6" }}>({count})</span>
      )}
    </span>
  );
}
