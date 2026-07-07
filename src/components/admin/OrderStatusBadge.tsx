/** Order-status pill — consistent colours across the admin orders UI + tracking. */
const STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  placed: { bg: "#EEF0FE", fg: "#4E5BDC", label: "Placed" },
  confirmed: { bg: "#E6F0FF", fg: "#2563C9", label: "Confirmed" },
  packed: { bg: "#FFF3E0", fg: "#C77700", label: "Packed" },
  shipped: { bg: "#E7F3EC", fg: "#1F9D63", label: "Shipped" },
  partially_shipped: { bg: "#FBF0E4", fg: "#B4690E", label: "Partially shipped" },
  out_for_delivery: { bg: "#E7F3EC", fg: "#1F8F5B", label: "Out for delivery" },
  delivered: { bg: "#1F9D63", fg: "#fff", label: "Delivered" },
  cancelled: { bg: "#FBE9E4", fg: "#B43A16", label: "Cancelled" },
};

export default function OrderStatusBadge({ status, size = 12 }: { status: string; size?: number }) {
  const s = STYLES[status] ?? { bg: "#EEF0F4", fg: "#56627A", label: status };
  return (
    <span style={{ display: "inline-block", background: s.bg, color: s.fg, fontSize: size, fontWeight: 700, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

export const STATUS_LABEL = (status: string) => STYLES[status]?.label ?? status;
