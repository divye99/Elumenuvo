"use client";

import { useState } from "react";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { baseExGst, shippingFeeFor, FREE_SHIPPING_MIN } from "@/lib/pricing";

/** Mobile-only sticky bar pinned to the bottom of the product page - price +
 *  a sleek “Add to basket”. Hidden entirely on desktop via CSS (.pd-buybar).
 *
 *  It used to hide itself on every downward scroll (useScrollDown(140)), which
 *  meant the buy button vanished the moment anyone started reading the page -
 *  precisely when they are deciding. It now stays put for the whole scroll.
 *  The hook is untouched: HeaderScrollFx still uses it for the header. */
export default function MobileBuyBar({
  price,
  unit,
  cat,
  gstRate,
  onAdd,
}: {
  price: number;
  unit: string;
  cat?: string;
  gstRate?: number;
  onAdd: () => void;
}) {
  const [added, setAdded] = useState(false);

  return (
    <div className="pd-buybar">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
          {fmt(baseExGst(price, cat, gstRate))} <span style={{ fontSize: 9.5, fontWeight: 500, color: "#9AA3B8" }}>/{unit} + GST</span>
        </div>
        {/* Only promise free delivery when THIS item alone already earns it;
            below that, state the threshold rather than a blanket claim. */}
        <div style={{ fontSize: 8.5, color: "#8EE2B8", fontWeight: 600, marginTop: 1 }}>
          {shippingFeeFor(price) === 0 ? "Free pan-India delivery" : `Free delivery over ${fmt(FREE_SHIPPING_MIN)}`}
        </div>
      </div>
      <button
        data-cart-tracked
        onClick={() => {
          onAdd();
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
        }}
        style={{
          flexShrink: 0,
          background: added ? "#1F9D63" : "#1D2F8A",
          color: "#fff",
          fontWeight: 700,
          fontSize: 12.5,
          border: "none",
          borderRadius: 10,
          padding: "10px 18px",
          cursor: "pointer",
          transition: "background .2s ease",
        }}
      >
        {added ? "✓ Added" : "Add to basket"}
      </button>
    </div>
  );
}
