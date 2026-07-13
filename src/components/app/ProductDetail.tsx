"use client";

import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { tileFor, type Product } from "@/lib/data";
import {
  wholesalePrice,
  unitPriceFor,
  offMrpPct,
  WHOLESALE_MIN_QTY,
  gstBreakdown,
  baseExGst,
} from "@/lib/pricing";

/**
 * Shared product-detail view. Used by BOTH the signed-in dashboard (variant
 * "app" — add to PO / project) and the public catalogue (variant "public" —
 * sign-in to order). Visually identical; only the action row differs.
 */
export default function ProductDetail({
  p,
  qty,
  setQty,
  onCatalogue,
  variant = "app",
  onAdd,
  onProject,
  onSignIn,
  onAddToCart,
  onBuyNow,
  ratingSummary,
  variantSlot,
  priceHistorySlot,
  showGst = false,
}: {
  p: Product;
  qty: number;
  setQty: (n: number) => void;
  onCatalogue: () => void;
  variant?: "app" | "public";
  onAdd?: () => void;
  onProject?: () => void;
  onSignIn?: () => void;
  onAddToCart?: () => void;
  onBuyNow?: () => void;
  /** Optional slots (public storefront): star summary next to the brand row,
   *  a variant picker between the title and price, and a compact price-history
   *  bar under the specs (left column). */
  ratingSummary?: React.ReactNode;
  variantSlot?: React.ReactNode;
  priceHistorySlot?: React.ReactNode;
  /** Business accounts see the price split into base + GST. */
  showGst?: boolean;
}) {
  const off = offMrpPct(p.price, p.market) + "%";
  const ws = wholesalePrice(p.price);
  const isWholesale = qty >= WHOLESALE_MIN_QTY;
  const lineTotal = unitPriceFor(p.price, qty) * qty;
  const gb = gstBreakdown(p.price, p.cat); // ex-GST base / GST / inclusive, at the category rate
  const specs = [
    { k: "Brand", v: p.brand },
    { k: "Category", v: p.cat },
    { k: "Specification", v: p.spec },
    { k: "SKU", v: p.sku },
    { k: "Availability", v: "In stock · ships in 24h" },
    { k: "Delivery", v: "Pan-India · 3–7 working days" },
  ];
  return (
    <div className="pd-wrap" style={{ padding: "22px 30px 40px", maxWidth: 1120, margin: "0 auto", animation: "elumeFade .35s ease" }}>
      <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 16 }}>
        <span onClick={onCatalogue} style={{ cursor: "pointer" }}>Catalogue</span> &nbsp;/&nbsp; {p.cat} &nbsp;/&nbsp; <span style={{ color: "#56627A" }}>{p.name}</span>
      </div>

      <div className="pd-grid" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
        {/* image + specs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ height: 230, position: "relative" }}>
              <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} imageUrl={p.image} />
              <span style={{ position: "absolute", left: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 10.5, color: "#6b748c", background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 6 }}>{p.sku}</span>
              <span style={{ position: "absolute", right: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "5px 10px", borderRadius: 7 }}>↓ {off} off MRP</span>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "6px 18px" }}>
            {specs.map((r) => (
              <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: "1px solid #F5F6F9" }}>
                <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{r.k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E", textAlign: "right" }}>{r.v}</span>
              </div>
            ))}
          </div>
          {/* compact price-history bar, under the specs */}
          {priceHistorySlot}
        </div>

        {/* info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1F9D63" }} />
              <span style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 600 }}>{p.brand}</span>
              <span style={{ fontSize: 11, color: "#1F9D63", fontWeight: 600 }}>· In stock</span>
              {ratingSummary && <span style={{ marginLeft: 6 }}>{ratingSummary}</span>}
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 25, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 16px" }}>{p.name}</h2>

            {variantSlot}

            {/* Elume price — ex-GST is the headline; GST shown as a statutory add-on */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 4 }}>
              <span className="pd-price" style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-1px", color: "#19202E" }}>{fmt(gb.base)}</span>
              <span style={{ fontSize: 14, color: "#8A93A6", marginBottom: 6 }}>/{p.unit}</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3px", color: "#4E5BDC", background: "#EEF0FD", padding: "4px 9px", borderRadius: 7, marginBottom: 7 }}>+ {Math.round(gb.rate * 100)}% GST</span>
            </div>
            {/* Inclusive total + MRP reference (all figures ex-GST for a like-for-like %) */}
            <div style={{ fontSize: 13, color: "#56627A", marginBottom: showGst ? 8 : 14 }}>
              <b style={{ color: "#19202E" }}>{fmt(gb.incl)}</b> incl. GST · MRP{" "}
              <span style={{ textDecoration: "line-through", color: "#A0A7B5" }}>{fmt(baseExGst(p.market, p.cat))}</span>
              <span style={{ color: "#1F9D63", fontWeight: 700, marginLeft: 8 }}>{off} off</span>
            </div>
            {/* GST breakdown for business accounts */}
            {showGst && (
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 10, padding: "9px 13px", marginBottom: 14, fontSize: 12.5 }}>
                <span style={{ color: "#56627A" }}>Base <b style={{ color: "#19202E" }}>{fmt(gb.base)}</b></span>
                <span style={{ color: "#56627A" }}>GST {Math.round(gb.rate * 100)}% <b style={{ color: "#19202E" }}>{fmt(gb.gst)}</b></span>
                <span style={{ color: "#56627A" }}>Total <b style={{ color: "#19202E" }}>{fmt(gb.incl)}</b></span>
                <span style={{ fontSize: 11, color: "#4E5BDC", fontWeight: 600 }}>Business · GST invoice</span>
              </div>
            )}
            {/* Wholesale tier */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 11, padding: "11px 14px", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Wholesale · {WHOLESALE_MIN_QTY}+ units</div>
                <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E" }}>
                  {fmt(baseExGst(ws, p.cat))} <span style={{ fontSize: 12, color: "#8A93A6", fontWeight: 400 }}>+GST /{p.unit}</span>
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "5px 10px", borderRadius: 8 }}>save 5%</span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #E8EBF1", borderRadius: 11, overflow: "hidden" }}>
                <div onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>−</div>
                <div style={{ width: 54, textAlign: "center", fontFamily: GROTESK, fontSize: 16, fontWeight: 600 }}>{qty}</div>
                <div onClick={() => setQty(qty + 1)} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>+</div>
              </div>
              {variant === "app" ? (
                <>
                  <div onClick={onAdd} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, textAlign: "center", padding: 14, borderRadius: 11, cursor: "pointer" }}>Add to PO · {fmt(lineTotal)}</div>
                  <div onClick={onProject} style={{ background: "#fff", border: "1.5px solid #E0E4ED", color: "#19202E", fontWeight: 600, fontSize: 13.5, padding: "13px 18px", borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Add to a project</div>
                </>
              ) : (
                <>
                  <div onClick={onAddToCart} style={{ flex: 1, background: "#fff", border: "1.5px solid #4E5BDC", color: "#4E5BDC", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "12px 14px", borderRadius: 11, cursor: "pointer" }}>Add to cart</div>
                  <div onClick={onBuyNow} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "13px 14px", borderRadius: 11, cursor: "pointer" }}>Buy now</div>
                </>
              )}
            </div>
            {isWholesale && (
              <div style={{ fontSize: 12.5, color: "#1F9D63", fontWeight: 600, marginTop: 10 }}>
                ✓ Wholesale price applied — {fmt(ws)}/{p.unit} on {qty} units ({WHOLESALE_MIN_QTY}+)
              </div>
            )}
            {variant === "public" && (
              <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 12 }}>
                🚚 Delivered pan-India · 30-day NBFC credit is coming soon —{" "}
                <a href="/credit" style={{ color: "#4E5BDC", fontWeight: 600 }}>
                  join the waitlist
                </a>
                .
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

