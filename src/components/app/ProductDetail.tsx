"use client";

import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { tileFor, type Product } from "@/lib/data";
import { isMetalCategory, lotKg } from "@/lib/metals";
import ProductGallery from "@/components/storefront/ProductGallery";
import {
  wholesalePrice,
  wholesaleEligible,
  unitPriceFor,
  offMrpPct,
  WHOLESALE_MIN_QTY,
  gstBreakdown,
  baseExGst,
} from "@/lib/pricing";

/**
 * Shared product-detail view. Used by BOTH the signed-in dashboard (variant
 * "app" - add to PO / project) and the public catalogue (variant "public" -
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
  onAddWholesale,
  ratingSummary,
  abovePrice,
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
  /** One click adds the qualifying wholesale quantity (15+) to the cart. */
  onAddWholesale?: () => void;
  /** Optional slots (public storefront): star summary next to the brand row,
   *  a variant picker between the title and price, and a compact price-history
   *  bar under the specs (left column). */
  ratingSummary?: React.ReactNode;
  abovePrice?: React.ReactNode;
  variantSlot?: React.ReactNode;
  priceHistorySlot?: React.ReactNode;
  /** Business accounts see the price split into base + GST. */
  showGst?: boolean;
}) {
  const offPct = offMrpPct(p.price, p.market);
  const off = offPct + "%";
  const ws = wholesalePrice(p.price);
  const canWholesale = wholesaleEligible(p.cat);
  const isWholesale = canWholesale && qty >= WHOLESALE_MIN_QTY;
  const lineTotal = unitPriceFor(p.price, qty, p.cat) * qty;
  const gb = gstBreakdown(p.price, p.cat, p.gstRate); // ex-GST base / GST / inclusive, at the category rate
  const galleryImages = (p.images?.length ? p.images : p.image ? [p.image] : []).filter(Boolean);
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
        {/* image + specs.
            On mobile this wrapper dissolves (display:contents) so the gallery,
            the buy box and the quick specs become siblings of the same
            single-column grid, letting quick specs sit BELOW the buy stack.
            Reordering the grid's own children could not do that: the gallery
            would have gone below the buy box with it. */}
        <div className="pd-media-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Gallery: multi-photo with lightbox + hover zoom on the public
              store; the workspace keeps the upload-capable single slot. */}
          <div data-pdp-sec="gallery" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, position: "relative" }}>
            {variant === "public" && galleryImages.length > 0 ? (
              <ProductGallery
                images={galleryImages}
                pid={p.id}
                alt={p.name}
                skuLabel={p.sku}
                offLabel={offPct >= 1 ? `↓ ${off} off MRP` : undefined}
              />
            ) : (
              <div style={{ height: 230, position: "relative", borderRadius: 16, overflow: "hidden" }}>
                <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} imageUrl={p.image} allowUpload={variant === "app"} />
                <span style={{ position: "absolute", left: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 10.5, color: "#6b748c", background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 6 }}>{p.sku}</span>
                {offPct >= 1 && <span style={{ position: "absolute", right: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "5px 10px", borderRadius: 7 }}>↓ {off} off MRP</span>}
              </div>
            )}
          </div>
          <div data-pdp-sec="quickspecs" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "6px 18px" }}>
            {specs.map((r) => (
              <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: "1px solid #F5F6F9" }}>
                <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{r.k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E", textAlign: "right" }}>{r.v}</span>
              </div>
            ))}
          </div>
          {/* compact price-history bar, under the specs.
              If this is ever wired up, give it an explicit `order` in the
              mobile rule below or it will land above the buy box. */}
          {priceHistorySlot}
        </div>

        {/* info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div data-pdp-sec="buybox" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1F9D63" }} />
              <span style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 600 }}>{p.brand}</span>
              <span style={{ fontSize: 11, color: "#1F9D63", fontWeight: 600 }}>· In stock</span>
              {ratingSummary && <span style={{ marginLeft: 6 }}>{ratingSummary}</span>}
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 25, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 16px" }}>{p.name}</h2>

            {variantSlot}

            {abovePrice}

            {/* Elume price - ex-GST is the headline; GST shown as a statutory add-on */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 4 }}>
              <span className="pd-price" style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-1px", color: "#19202E" }}>{fmt(gb.base)}</span>
              <span style={{ fontSize: 14, color: "#8A93A6", marginBottom: 6 }}>/{p.unit}</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3px", color: "#4E5BDC", background: "#EEF0FD", padding: "4px 9px", borderRadius: 7, marginBottom: 7 }}>+ {Math.round(gb.rate * 100)}% GST</span>
            </div>
            {/* Metals rate card: the trade thinks in ₹/kg, buyers compare lot
                totals - show today's rate at per-kg, 3 MT and 4 MT in one card. */}
            {isMetalCategory(p.cat) && lotKg(p.attrs) > 1 && (() => {
              const kg = lotKg(p.attrs);
              const rate = gb.base / kg;
              const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
              return (
                <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 11, padding: "12px 15px", margin: "0 0 12px" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 6 }}>Today's rate</div>
                  {[
                    ["Per kg", `₹${rate.toLocaleString("en-IN", { maximumFractionDigits: 2 })} +GST`],
                    ["3 MT lot (3,000 kg)", `${inr(rate * 3000)} +GST`],
                    ["4 MT lot (4,000 kg)", `${inr(rate * 4000)} +GST`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13 }}>
                      <span style={{ color: "#56627A" }}>{k}</span>
                      <span style={{ fontWeight: 700, color: "#19202E", fontFamily: GROTESK }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#8A93A6", marginTop: 4 }}>Updated against MCX &amp; LME · ~9 am, 11 am and 2 pm IST on trading days</div>
                </div>
              );
            })()}
            {/* Inclusive total + MRP reference (all figures ex-GST for a like-for-like %) */}
            <div style={{ fontSize: 13, color: "#56627A", marginBottom: showGst ? 8 : 14 }}>
              <b style={{ color: "#19202E" }}>{fmt(gb.incl)}</b> incl. GST
              {offPct >= 1 && (
                <>
                  {" "}· MRP{" "}
                  <span style={{ textDecoration: "line-through", color: "#A0A7B5" }}>{fmt(baseExGst(p.market, p.cat, p.gstRate))}</span>
                  <span style={{ color: "#1F9D63", fontWeight: 700, marginLeft: 8 }}>{off} off</span>
                </>
              )}
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
            {/* Wholesale tier (FMEG only - commodity-priced metals sell at the quoted rate) */}
            {canWholesale && (
            <div data-pdp-sec="wholesale" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 11, padding: "11px 14px", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Wholesale · {WHOLESALE_MIN_QTY}+ units</div>
                <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E" }}>
                  {fmt(baseExGst(ws, p.cat, p.gstRate))} <span style={{ fontSize: 12, color: "#8A93A6", fontWeight: 400 }}>+GST /{p.unit}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "5px 10px", borderRadius: 8 }}>save 5%</span>
                {variant === "public" && onAddWholesale && (
                  <button
                    data-cart-tracked
                    onClick={onAddWholesale}
                    style={{ background: "#4E5BDC", color: "#fff", border: "none", fontWeight: 700, fontSize: 11.5, padding: "7px 12px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
                  >
                    Add {WHOLESALE_MIN_QTY} to cart
                  </button>
                )}
              </div>
            </div>
            )}

            {p.inStock === false ? (
              <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 600, color: "#19202E" }}>Out of stock</div>
                <p style={{ fontSize: 13, color: "#56627A", margin: "6px 0 0", lineHeight: 1.55 }}>
                  We list this so you can see the spec and our price, but it cannot be ordered right now.
                  Email <a href="mailto:info@elumenuvo.com" style={{ color: "#4E5BDC", fontWeight: 600 }}>info@elumenuvo.com</a> and we will source it for you.
                </p>
              </div>
            ) : isMetalCategory(p.cat) && variant === "public" ? (
              // Metals never use the cart: lakh-scale lots book via the
              // 5%-token + RTGS flow (server-side checkout guard mirrors this).
              <div>
                <a
                  href={`/metals/book/${encodeURIComponent(p.id)}`}
                  data-cart-tracked
                  style={{ display: "block", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 15, textAlign: "center", padding: "14px 16px", borderRadius: 11 }}
                >
                  Book at today's rate →
                </a>
                <div style={{ fontSize: 12, color: "#56627A", marginTop: 10, lineHeight: 1.5 }}>
                  Business account (GSTIN) · 5% token online locks the rate · balance by RTGS · GST tax invoice with dispatch.
                </div>
              </div>
            ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #E8EBF1", borderRadius: 11, overflow: "hidden" }}>
                <div onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>−</div>
                <div style={{ width: 54, textAlign: "center", fontFamily: GROTESK, fontSize: 16, fontWeight: 600 }}>{qty}</div>
                <div onClick={() => setQty(qty + 1)} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>+</div>
              </div>
              {variant === "app" ? (
                <>
                  <div onClick={onAdd} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, textAlign: "center", padding: 14, borderRadius: 11, cursor: "pointer" }}>{onProject ? "Add to PO" : "Add to cart"} · {fmt(lineTotal)}</div>
                  {onProject && <div onClick={onProject} style={{ background: "#fff", border: "1.5px solid #E0E4ED", color: "#19202E", fontWeight: 600, fontSize: 13.5, padding: "13px 18px", borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Add to a project</div>}
                </>
              ) : (
                <>
                  <div onClick={onAddToCart} style={{ flex: 1, background: "#fff", border: "1.5px solid #4E5BDC", color: "#4E5BDC", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "12px 14px", borderRadius: 11, cursor: "pointer" }}>Add to cart</div>
                  <div onClick={onBuyNow} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, textAlign: "center", padding: "13px 14px", borderRadius: 11, cursor: "pointer" }}>Buy now</div>
                </>
              )}
            </div>
            )}
            {isWholesale && (
              <div style={{ fontSize: 12.5, color: "#1F9D63", fontWeight: 600, marginTop: 10 }}>
                ✓ Wholesale price applied - {fmt(ws)}/{p.unit} on {qty} units ({WHOLESALE_MIN_QTY}+)
              </div>
            )}
            {variant === "public" && (
              <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 12 }}>
                🚚 Delivered pan-India · 30-day NBFC credit is coming soon -{" "}
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

