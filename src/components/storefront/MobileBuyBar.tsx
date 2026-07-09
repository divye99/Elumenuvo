"use client";

import { useState } from "react";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { useScrollDown } from "@/lib/useScrollDown";

/** Mobile-only sticky bar pinned to the bottom of the product page — price +
 *  a sleek “Add to basket”. Hides while scrolling down, returns on scroll up.
 *  Hidden entirely on desktop via CSS (.pd-buybar). */
export default function MobileBuyBar({
  price,
  unit,
  onAdd,
}: {
  price: number;
  unit: string;
  onAdd: () => void;
}) {
  const hidden = useScrollDown(140);
  const [added, setAdded] = useState(false);

  return (
    <div className={`pd-buybar${hidden ? " hidden" : ""}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
          {fmt(price)} <span style={{ fontSize: 9.5, fontWeight: 500, color: "#9AA3B8" }}>/{unit} · incl. GST</span>
        </div>
        <div style={{ fontSize: 8.5, color: "#8EE2B8", fontWeight: 600, marginTop: 1 }}>Free pan-India delivery</div>
      </div>
      <button
        onClick={() => {
          onAdd();
          setAdded(true);
          setTimeout(() => setAdded(false), 1400);
        }}
        style={{
          flexShrink: 0,
          background: added ? "#1F9D63" : "#4E5BDC",
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
