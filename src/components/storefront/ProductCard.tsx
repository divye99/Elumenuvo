"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageSlot from "@/components/ImageSlot";
import Rating from "@/components/storefront/Rating";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { tileFor, type Product } from "@/lib/data";
import { valuesOf, bestMatch, COLOUR_HEX } from "@/lib/variants";

const MAX_SWATCHES = 5;

/**
 * Product tile used across the public store — catalogue grid and home shelves.
 * `fixedWidth` pins the card for horizontal-scroll shelves; grids leave it off.
 * When `siblings` (variant family) is passed, hovering the card reveals
 * Amazon-style colour/size swatches that jump straight to that variant.
 */
export default function ProductCard({
  p,
  fixedWidth,
  siblings = [],
}: {
  p: Product;
  fixedWidth?: number;
  siblings?: Product[];
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  const save = Math.round((1 - p.price / p.market) * 100) + "%";

  const hasVariants = siblings.length > 1 && !!p.attrs;
  const colours = hasVariants ? valuesOf(siblings, "Colour") : [];
  const sizes = hasVariants ? valuesOf(siblings, "Size") : [];
  const showSwatches = hover && (colours.length > 1 || sizes.length > 1);

  const jump = (e: React.MouseEvent, dim: string, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    const best = bestMatch(p, siblings, dim, value);
    if (best) router.push(`/catalogue/${best.id}`);
  };

  return (
    <Link
      href={`/catalogue/${p.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hover ? "#C9CFF6" : "#E8EBF1"}`,
        boxShadow: hover ? "0 10px 28px rgba(20,24,45,.10)" : "none",
        transition: "border-color .15s, box-shadow .15s",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: fixedWidth,
        flexShrink: fixedWidth ? 0 : undefined,
        position: "relative",
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

        {/* Hover variant swatches (Amazon-style) */}
        {showSwatches && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              gap: 7,
              padding: "10px 11px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.96) 60%, rgba(255,255,255,0))",
              animation: "elumeFade .18s ease",
            }}
          >
            {colours.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {colours.slice(0, MAX_SWATCHES).map((v) => {
                  const active = p.attrs?.Colour === v;
                  return (
                    <button
                      key={v}
                      onClick={(e) => jump(e, "Colour", v)}
                      title={v}
                      aria-label={`Colour ${v}`}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        cursor: "pointer",
                        background: COLOUR_HEX[v] ?? "#CBD2DE",
                        border: "2px solid #fff",
                        outline: active ? "2px solid #4E5BDC" : "1px solid rgba(0,0,0,0.18)",
                        padding: 0,
                      }}
                    />
                  );
                })}
                {colours.length > MAX_SWATCHES && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#56627A" }}>+{colours.length - MAX_SWATCHES}</span>
                )}
              </div>
            )}
            {sizes.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {sizes.slice(0, MAX_SWATCHES).map((v) => {
                  const active = p.attrs?.Size === v;
                  return (
                    <button
                      key={v}
                      onClick={(e) => jump(e, "Size", v)}
                      title={`Size ${v}`}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 7,
                        cursor: "pointer",
                        background: active ? "#4E5BDC" : "#fff",
                        color: active ? "#fff" : "#3A4358",
                        border: `1px solid ${active ? "#4E5BDC" : "#D5DAE4"}`,
                        boxShadow: "0 2px 6px rgba(20,24,45,.08)",
                      }}
                    >
                      {v.replace(" sq mm", "")}
                    </button>
                  );
                })}
                {sizes.length > MAX_SWATCHES && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#56627A" }}>+{sizes.length - MAX_SWATCHES}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ padding: "15px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
          <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{p.brand}</span>
          {hasVariants && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FE", padding: "2px 7px", borderRadius: 8, marginLeft: "auto" }}>
              {siblings.length} options
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0", lineHeight: 1.3 }}>{p.name}</div>
        {p.rating && p.ratingCount ? (
          <div style={{ margin: "1px 0 4px" }}>
            <Rating rating={p.rating} count={p.ratingCount} size={12} />
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
