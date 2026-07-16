"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { fmt } from "@/lib/format";
import { wholesalePrice, WHOLESALE_MIN_QTY } from "@/lib/pricing";
import type { Product } from "@/lib/data";

/** One-click "add the wholesale quantity" CTA, shown wherever a detail page
 *  quotes the 15+ wholesale price. Adds exactly WHOLESALE_MIN_QTY units so the
 *  cart's per-line wholesale discount (-5% at 15+) applies immediately. */
export default function WholesaleAddButton({ p }: { p: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);

  if (added) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: "#1F9D63" }}>
        ✓ {WHOLESALE_MIN_QTY} {p.unit}s in cart at {fmt(wholesalePrice(p.price))}/{p.unit} ·{" "}
        <Link href="/cart" style={{ color: "#4E5BDC" }}>View cart →</Link>
      </div>
    );
  }
  return (
    <button
      onClick={() => {
        add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, image: p.image }, WHOLESALE_MIN_QTY);
        setAdded(true);
      }}
      style={{ marginTop: 10, background: "#EEF0FE", color: "#4E5BDC", border: "none", fontWeight: 700, fontSize: 11.5, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}
    >
      Add {WHOLESALE_MIN_QTY} {p.unit}s to cart
    </button>
  );
}
