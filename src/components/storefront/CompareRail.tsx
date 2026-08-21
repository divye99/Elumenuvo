"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import { fmt } from "@/lib/format";
import { gstBreakdown } from "@/lib/pricing";
import PdpCollapse from "@/components/storefront/PdpCollapse";
import type { CompareItem } from "@/lib/compare/rail";

/**
 * "Compare with other items": the like-to-like table below price history.
 *
 * The current product is FROZEN as the first column (sticky, next to the
 * spec labels); every mapped alternative scrolls horizontally beside it.
 * Same 5 key specs for the whole row set - the group shares a fingerprint,
 * so the tables line up by construction. Neutral by design: prices sit side
 * by side with no winner tag, the shopper does the maths.
 *
 * Row heights are FIXED so the sticky label column and every product column
 * stay aligned - the layout is one horizontal flex of identical column
 * stacks, not a real <table>.
 *
 * Every click-through and add-to-cart is logged (compare_pick/compare_add),
 * which is what teaches the rail its ordering over time.
 */

export type CompareCurrent = CompareItem; // same shape - the pinned column

const H_TOP = 172;
const H_SPEC = 40;
const H_PRICE = 58;
const H_ACT = 60;

const row = (h: number): React.CSSProperties => ({
  height: h, boxSizing: "border-box", padding: "0 12px", borderTop: "1px solid #F0F2F6",
  display: "flex", flexDirection: "column", justifyContent: "center",
});
const labelCss = (h: number): React.CSSProperties => ({
  ...row(h), fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#8A93A6",
});

export default function CompareRail({ current, items, pageSlug }: { current: CompareCurrent; items: CompareItem[]; pageSlug?: string }) {
  const cart = useCart();
  const [added, setAdded] = useState<Set<string>>(new Set());

  const labels = current.display.map(([l]) => l);
  const specOf = (p: CompareItem, label: string) => p.display.find(([l]) => l === label)?.[1] ?? "-";

  const addToCart = (p: CompareItem) => {
    cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.mrp, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image, shipWeightKg: p.shipWeightKg }, 1);
    setAdded((prev) => new Set(prev).add(p.id));
    track("compare_add", { detail: { from: current.id, to: p.id } });
  };

  const cols = [current, ...items];

  return (
    <div className="pdp-wrap" style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
      <PdpCollapse title="Compare with other items" sec="compare" count={`${items.length} similar`}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "0 0 12px" }}>
          <span style={{ fontSize: 12.5, color: "#8A93A6" }}>
            Same key specifications, different brands - matched on spec, never on looks. Tap a product to open it.
          </span>
          {pageSlug && (
            <Link href={`/compare/${pageSlug}`} style={{ fontSize: 12.5, fontWeight: 700, color: "#1D2F8A", whiteSpace: "nowrap" }}>
              Full comparison page →
            </Link>
          )}
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, overflowX: "auto" }}>
          <div style={{ display: "flex", minWidth: "max-content" }}>
            {/* Frozen label column */}
            <div className="cmp-labels" style={{ display: "flex", flexDirection: "column", position: "sticky", left: 0, zIndex: 3, background: "#fff", flex: "none" }}>
              <div style={{ ...labelCss(H_TOP), borderTop: "none" }}>Product</div>
              {labels.map((l) => <div key={l} style={labelCss(H_SPEC)}>{l}</div>)}
              <div style={labelCss(H_PRICE)}>Price</div>
              <div style={labelCss(H_ACT)} />
            </div>

            {cols.map((p, i) => {
              const isCurrent = i === 0;
              const gb = gstBreakdown(p.price, p.cat, p.gstRate);
              return (
                <div
                  key={p.id}
                  className={`cmp-col${isCurrent ? " cmp-current" : ""}`}
                  style={{
                    display: "flex", flexDirection: "column", flex: "none", borderLeft: "1px solid #F0F2F6",
                    ...(isCurrent ? { position: "sticky", zIndex: 2, background: "#FBFCFE", boxShadow: "6px 0 8px -6px rgba(25,32,46,0.14)" } : {}),
                  }}
                >
                  {/* Photo + name (click-through on alternatives) */}
                  <div style={{ ...row(H_TOP), borderTop: "none", justifyContent: "flex-start", paddingTop: 12 }}>
                    {isCurrent ? (
                      <span style={{ fontSize: 9.5, fontWeight: 800, color: "#1D2F8A", background: "#E9EDF9", padding: "2px 8px", borderRadius: 6, alignSelf: "flex-start" }}>THIS PRODUCT</span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#8A93A6" }}>{p.brand.toUpperCase()}</span>
                    )}
                    <Link prefetch={false}
                      href={`/catalogue/${p.id}`}
                      onClick={(e) => { if (isCurrent) { e.preventDefault(); return; } track("compare_pick", { detail: { from: current.id, to: p.id } }); }}
                      style={{ display: "block", cursor: isCurrent ? "default" : "pointer" }}
                      aria-label={isCurrent ? undefined : `View ${p.name}`}
                    >
                      <div style={{ width: "100%", height: 78, margin: "7px 0 6px", borderRadius: 10, border: "1px solid #EEF0F4", background: p.image ? `center/contain no-repeat url(${p.image}) #fff` : "#F5F6F9" }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? "#19202E" : "#3A46B8", lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {p.name}
                      </div>
                    </Link>
                  </div>
                  {labels.map((l) => (
                    <div key={l} style={{ ...row(H_SPEC), fontSize: 12.5, color: "#3A4358", whiteSpace: "nowrap", overflow: "hidden" }} title={specOf(p, l)}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{specOf(p, l)}</span>
                    </div>
                  ))}
                  {/* Price - storefront convention: ex-GST headline, inclusive below */}
                  <div style={row(H_PRICE)}>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#19202E" }}>{fmt(gb.base)}</span>
                      <span style={{ fontSize: 10.5, color: "#8A93A6" }}> +GST /{p.unit}</span>
                    </div>
                    <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>{fmt(gb.incl)} incl. GST</div>
                  </div>
                  <div style={row(H_ACT)}>
                    {isCurrent ? (
                      <span style={{ fontSize: 11.5, color: "#8A93A6" }}>Viewing above ↑</span>
                    ) : added.has(p.id) ? (
                      <Link href="/cart" style={{ fontSize: 12, fontWeight: 700, color: "#137a4b" }}>✓ Added · view cart →</Link>
                    ) : (
                      <button
                        onClick={() => addToCart(p)}
                        style={{ width: "100%", background: "#1D2F8A", color: "#fff", border: "none", fontWeight: 700, fontSize: 12, padding: "8px 10px", borderRadius: 8, cursor: "pointer" }}
                      >
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PdpCollapse>
      <style>{`
        .cmp-labels { width: 108px; }
        .cmp-col { width: 196px; }
        .cmp-current { left: 108px; }
        @media (max-width: 640px) {
          /* Phones: the frozen current-product column ate half the screen and
             made side-by-side comparison impossible. The labels stay frozen
             (they're the anchor); the current product scrolls WITH the rail -
             the page above it already is the current product. Columns shrink
             so ~2.2 alternatives fit a 375px screen. */
          .cmp-labels { width: 64px; }
          .cmp-labels > div { font-size: 9px !important; padding: 0 7px !important; }
          .cmp-col { width: 138px; }
          .cmp-current { position: static !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
