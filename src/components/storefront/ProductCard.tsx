"use client";

import { useState } from "react";
import Link from "next/link";
import ImageSlot from "@/components/ImageSlot";
import { Star } from "@/components/storefront/Rating";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { tileFor, type Product } from "@/lib/data";
import { valuesOf, bestMatch, COLOUR_HEX } from "@/lib/variants";
import { useCart } from "@/lib/cart";

const MAX_SWATCHES = 5;

/**
 * Product tile used across the public store — catalogue grid and home shelves.
 * `fixedWidth` pins the card for horizontal-scroll shelves; grids leave it off.
 * When `siblings` (variant family) is passed, hovering the card reveals
 * Amazon-style colour/size swatches. Clicking a swatch swaps THIS CARD to
 * that variant in place (name, price, SKU, link all update) — no navigation.
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
  const [hover, setHover] = useState(false);
  // The variant currently shown on this card — swatch clicks swap it in place.
  const [shown, setShown] = useState(p);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const save = Math.round((1 - shown.price / shown.market) * 100) + "%";

  const hasVariants = siblings.length > 1 && !!shown.attrs;
  const colours = hasVariants ? valuesOf(siblings, "Colour") : [];
  // Size chips for wires/switchgear; fans vary by Sweep instead.
  const plainSizes = hasVariants ? valuesOf(siblings, "Size") : [];
  const sizeDim = plainSizes.length > 1 ? "Size" : "Sweep";
  const sizes = hasVariants ? (plainSizes.length > 1 ? plainSizes : valuesOf(siblings, "Sweep")) : [];
  const showSwatches = hover && (colours.length > 1 || sizes.length > 1);

  const jump = (e: React.MouseEvent, dim: string, value: string) => {
    e.preventDefault();
    e.stopPropagation();
    const best = bestMatch(shown, siblings, dim, value);
    if (best) setShown(best);
  };

  return (
    <Link
      href={`/catalogue/${shown.id}`}
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
        <ImageSlot id={`img-${shown.sku}`} tile={tileFor(shown.cat)} imageUrl={shown.image} />
        <span
          style={{ position: "absolute", left: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, color: "#6b748c", background: "rgba(255,255,255,0.88)", padding: "3px 6px", borderRadius: 5 }}
        >
          {shown.sku}
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
                  const active = shown.attrs?.Colour === v;
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
                  const active = shown.attrs?.[sizeDim] === v;
                  return (
                    <button
                      key={v}
                      onClick={(e) => jump(e, sizeDim, v)}
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
                      {v.replace(" sq mm", "").replace(" mm", "mm")}
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
          <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{shown.brand}</span>
          {hasVariants && (
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FE", padding: "2px 7px", borderRadius: 8, marginLeft: "auto" }}>
              {siblings.length} options
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0", lineHeight: 1.3 }}>{shown.name}</div>
        {shown.rating && shown.ratingCount ? (
          <div style={{ margin: "1px 0 4px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Star size={13} />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4358" }}>{shown.rating.toFixed(1)}</span>
            </span>
            <div style={{ fontSize: 10, color: "#A0A7B5", marginTop: 1 }}>{shown.ratingCount} review{shown.ratingCount === 1 ? "" : "s"}</div>
          </div>
        ) : null}
        <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6", marginBottom: 13 }}>{shown.spec}</div>
        <div style={{ marginTop: "auto" }}>
          <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E" }}>{fmt(shown.price)}</div>
          <div style={{ fontSize: 11.5, color: "#A0A7B5" }}>
            MRP <span style={{ textDecoration: "line-through" }}>{fmt(shown.market)}</span>
          </div>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              add({ id: shown.id, name: shown.name, brand: shown.brand, price: shown.price, mrp: shown.market, unit: shown.unit, image: shown.image });
              setAdded(true);
              setTimeout(() => setAdded(false), 1200);
            }}
            style={{ width: "100%", marginTop: 10, background: added ? "#1F9D63" : "#EEF0FE", color: added ? "#fff" : "#4E5BDC", fontWeight: 700, fontSize: 12.5, border: "none", padding: "8px 10px", borderRadius: 9, cursor: "pointer" }}
          >
            {added ? "✓ Added" : "Add to cart"}
          </button>
        </div>
      </div>
    </Link>
  );
}
