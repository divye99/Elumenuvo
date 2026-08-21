"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageSlot from "@/components/ImageSlot";
import { Star } from "@/components/storefront/Rating";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { baseExGst } from "@/lib/pricing";
import { isMetalCategory } from "@/lib/metals";
import { tileFor, type Product } from "@/lib/data";
import { cardHighlights } from "@/lib/card-specs";
import { valuesOf, bestMatch, COLOUR_HEX } from "@/lib/variants";
import { useCart } from "@/lib/cart";

const MAX_SWATCHES = 5;

/** “Delivery by 16 Jul” - always 7 days from today (shown on mobile cards). */
function deliveryBy(): string {
  return new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Product tile used across the public store - catalogue grid and home shelves.
 * `fixedWidth` pins the card for horizontal-scroll shelves; grids leave it off.
 * When `siblings` (variant family) is passed, hovering the card reveals
 * Amazon-style colour/size swatches. Clicking a swatch swaps THIS CARD to
 * that variant in place (name, price, SKU, link all update) - no navigation.
 */
export default function ProductCard({
  p,
  fixedWidth,
  siblings = [],
  editorial = {},
  current = false,
  attrsLine,
}: {
  p: Product;
  fixedWidth?: number;
  siblings?: Product[];
  editorial?: Record<string, { bestFor: string; rank: number; slug: string; postTitle: string }>;
  /** Ring + "Viewing" chip: this card is the product already on screen.
   *  Used by the product page's full-range rail. */
  current?: boolean;
  /** What makes this option different (colour, length, size). The card's own
   *  highlight logic is category-driven and skips colour for some categories,
   *  which is exactly what a variant rail has to show. */
  attrsLine?: string;
}) {
  const router = useRouter();
  const [hover, setHover] = useState(false);
  // The variant currently shown on this card - swatch clicks swap it in place.
  const [shown, setShown] = useState(p);
  const [added, setAdded] = useState(false);
  const { add } = useCart();
  const savePct = Math.round((1 - shown.price / shown.market) * 100);
  const save = savePct + "%";
  // The house label prices with MRP == price: no strikethrough, no save badge.
  const hasDiscount = savePct >= 1;

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
    <Link prefetch={false}
      href={`/catalogue/${shown.id}`}
      // Viewport prefetch is off (a scripted viewer scrolling a grid used to
      // trigger dozens of cold product renders); hover prefetch is kept by
      // hand so a real click still lands on a warm route.
      onMouseEnter={() => { setHover(true); router.prefetch(`/catalogue/${shown.id}`); }}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        border: `1px solid ${hover ? "#B9C2F0" : "#E4E7EF"}`,
        boxShadow: hover ? "0 4px 14px rgba(20,24,45,.08)" : "none",
        transition: "border-color .15s, box-shadow .15s",
        borderRadius: 10,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        width: fixedWidth,
        flexShrink: fixedWidth ? 0 : undefined,
        position: "relative",
        ...(current ? { outline: "2px solid #1D2F8A", outlineOffset: -2 } : {}),
      }}
    >
      <div className="pc-img" style={{ height: 150, position: "relative" }}>
        {editorial[shown.id] && (
          <span
            title={`Ranked #${editorial[shown.id].rank} in ${editorial[shown.id].postTitle} - ${editorial[shown.id].bestFor}`}
            style={{ position: "absolute", right: 9, top: 9, zIndex: 3, pointerEvents: "none", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 800, color: "#7A4E00", background: "linear-gradient(135deg,#FFE9B8,#FFD873)", border: "1px solid #F0C64E", padding: "4px 9px", borderRadius: 999, boxShadow: "0 2px 8px rgba(122,78,0,.18)", letterSpacing: "0.2px" }}
          >
            🏆 #{editorial[shown.id].rank}
          </span>
        )}
        <ImageSlot id={`img-${shown.sku}`} tile={tileFor(shown.cat)} imageUrl={shown.image} />
        <span
          className="pc-sku"
          style={{ position: "absolute", left: 10, bottom: 10, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 9, color: "#8A93A6", background: "rgba(255,255,255,0.85)", padding: "2px 5px", borderRadius: 3 }}
        >
          {shown.sku}
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
                        outline: active ? "2px solid #1D2F8A" : "1px solid rgba(0,0,0,0.18)",
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
                        background: active ? "#1D2F8A" : "#fff",
                        color: active ? "#fff" : "#3A4358",
                        border: `1px solid ${active ? "#1D2F8A" : "#D5DAE4"}`,
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
      <div className="pc-body" style={{ padding: "15px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
          <span className="pc-brand" style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{shown.brand}</span>
          {hasVariants && (
            <span className="pc-opts" style={{ fontSize: 10, fontWeight: 700, color: "#1D2F8A", background: "#E9EDF9", padding: "2px 7px", borderRadius: 8, marginLeft: "auto" }}>
              {siblings.length} options
            </span>
          )}
        </div>
        <div className="pc-name" style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0", lineHeight: 1.3 }}>{shown.name}</div>
        {(attrsLine || current) && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "0 0 4px" }}>
            {attrsLine && <span style={{ fontSize: 11, color: "#56627A", fontWeight: 600 }}>{attrsLine}</span>}
            {current && (
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#1D2F8A", background: "#E9EDF9", padding: "2px 7px", borderRadius: 7 }}>Viewing</span>
            )}
          </div>
        )}

        {shown.rating && shown.ratingCount ? (
          <div style={{ margin: "1px 0 4px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Star size={13} />
              <span className="pc-rate" style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4358" }}>{shown.rating.toFixed(1)}</span>
            </span>
            <div style={{ fontSize: 10, color: "#A0A7B5", marginTop: 1 }}>{shown.ratingCount} review{shown.ratingCount === 1 ? "" : "s"}</div>
          </div>
        ) : null}
        {/* 2-3 decision specs (sweep/wattage/rating...), not the raw spec dump:
            the card's job is shortlisting within a grid, so only the facts
            that differentiate neighbouring products earn a line. */}
        <div className="pc-spec" style={{ marginBottom: 13, display: "flex", flexDirection: "column", gap: 2.5 }}>
          {cardHighlights(shown).map((h) => (
            <div key={h} style={{ display: "flex", alignItems: "baseline", gap: 6, fontSize: 11, color: "#56627A", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span style={{ color: "#1D2F8A", fontSize: 9, flexShrink: 0 }}>●</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto" }}>
          <div className="pc-price" style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E", display: "flex", alignItems: "baseline", gap: 5 }}>
            {fmt(baseExGst(shown.price, shown.cat, shown.gstRate))}
            <span style={{ fontSize: 10, fontWeight: 600, color: "#8A93A6" }}>+GST</span>
            {/* Save badge sits by the price (owner call, Aug 2026) - the
                discount belongs to the money, not the photo. */}
            {hasDiscount && (
              <span className="pc-save" style={{ fontSize: 11, fontWeight: 700, color: "#1F9D63", background: "#EAF7F0", padding: "2px 7px", borderRadius: 6, flexShrink: 0 }}>
                ↓ {save}
              </span>
            )}
          </div>
          <div className="pc-mrp" style={{ fontSize: 11.5, color: "#A0A7B5" }}>
            {hasDiscount ? (
              <>MRP <span style={{ textDecoration: "line-through" }}>{fmt(baseExGst(shown.market, shown.cat, shown.gstRate))}</span> · {fmt(shown.price)} incl.</>
            ) : (
              <>{fmt(shown.price)} incl. GST</>
            )}
          </div>
          <span className="pc-deliv" suppressHydrationWarning>{shown.inStock === false ? "Currently unavailable" : `Delivery by ${deliveryBy()}`}</span>
          {shown.inStock === false ? (
            <div style={{ width: "100%", marginTop: 10, background: "#F4F5F8", color: "#8A93A6", fontWeight: 700, fontSize: 12.5, padding: "8px 10px", borderRadius: 9, textAlign: "center" }}>
              Out of stock
            </div>
          ) : isMetalCategory(shown.cat) ? (
            // Metals book via the token flow, never the cart - the card's CTA
            // walks through to the PDP's "Book at today's rate".
            <div className="pc-cta" style={{ width: "100%", marginTop: 10, background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "8px 10px", borderRadius: 9, textAlign: "center" }}>
              Book at today's rate →
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                add({ id: shown.id, name: shown.name, brand: shown.brand, price: shown.price, mrp: shown.market, unit: shown.unit, cat: shown.cat, gstRate: shown.gstRate, image: shown.image, shipWeightKg: shown.shipWeightKg });
                setAdded(true);
                setTimeout(() => setAdded(false), 1200);
              }}
              className="pc-cta"
              style={{ width: "100%", marginTop: 10, background: added ? "#1F9D63" : "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 12.5, border: "none", padding: "8px 10px", borderRadius: 9, cursor: "pointer" }}
            >
              {added ? "✓ Added" : "Add to cart"}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
