import Link from "next/link";
import ImageSlot from "@/components/ImageSlot";
import Stars from "@/components/storefront/Stars";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { tileFor, type Product } from "@/lib/data";

/**
 * Product tile used across the public store — catalogue grid and home shelves.
 * `fixedWidth` pins the card for horizontal-scroll shelves; grids leave it off.
 */
export default function ProductCard({ p, fixedWidth }: { p: Product; fixedWidth?: number }) {
  const save = Math.round((1 - p.price / p.market) * 100) + "%";
  return (
    <Link
      href={`/catalogue/${p.id}`}
      style={{
        background: "#fff",
        border: "1px solid #E8EBF1",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: fixedWidth,
        flexShrink: fixedWidth ? 0 : undefined,
      }}
    >
      <div style={{ height: 150, position: "relative" }}>
        <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} imageUrl={p.image} />
        <span
          style={{ position: "absolute", left: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, color: "#6b748c", background: "rgba(255,255,255,0.88)", padding: "3px 6px", borderRadius: 5 }}
        >
          {p.sku}
        </span>
        <span
          style={{ position: "absolute", right: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontSize: 11, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "4px 8px", borderRadius: 6 }}
        >
          ↓ {save}
        </span>
      </div>
      <div style={{ padding: "15px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
          <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{p.brand}</span>
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0", lineHeight: 1.3 }}>{p.name}</div>
        {p.rating && p.ratingCount ? (
          <div style={{ margin: "1px 0 4px" }}>
            <Stars rating={p.rating} count={p.ratingCount} size={12} />
          </div>
        ) : null}
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6", marginBottom: 13 }}>{p.spec}</div>
        <div style={{ marginTop: "auto" }}>
          <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E" }}>{fmt(p.price)}</div>
          <div style={{ fontSize: 11.5, color: "#A0A7B5" }}>
            MRP <span style={{ textDecoration: "line-through" }}>{fmt(p.market)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
