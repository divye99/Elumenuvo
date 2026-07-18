"use client";

/**
 * Buy box for a ranked item in a top-10 blog post: live Elume price vs MRP
 * plus one-tap add to cart, so a reader can buy straight from the list.
 * Rendered only for items mapped to a product we actually stock.
 */
import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { fmt } from "@/lib/format";
import type { Product } from "@/lib/data";

export default function BlogBuyButton({ product }: { product: Product }) {
  const { add } = useCart();
  const [added, setAdded] = useState(false);
  const off = product.market > product.price ? Math.round(((product.market - product.price) / product.market) * 100) : 0;

  const onAdd = () => {
    add({ id: product.id, name: product.name, brand: product.brand, price: product.price, mrp: product.market, unit: product.unit, cat: product.cat, image: product.image });
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12, background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ minWidth: 150 }}>
        <div style={{ fontSize: 11, color: "#8A93A6", lineHeight: 1.3 }}>
          On Elume · <Link href={`/catalogue/${product.id}`} style={{ color: "#4E5BDC", fontWeight: 600 }}>{product.name.length > 44 ? product.name.slice(0, 42) + "…" : product.name}</Link>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
          <span style={{ fontWeight: 700, fontSize: 16.5, color: "#19202E" }}>{fmt(product.price)}</span>
          {off > 0 && (
            <>
              <span style={{ fontSize: 12.5, color: "#A0A7B5", textDecoration: "line-through" }}>{fmt(product.market)}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1F9D63" }}>{off}% off</span>
            </>
          )}
          <span style={{ fontSize: 11, color: "#8A93A6" }}>/ {product.unit}</span>
        </div>
      </div>
      <button
        onClick={onAdd}
        style={{ marginLeft: "auto", background: added ? "#1F9D63" : "#19202E", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "background .2s" }}
      >
        {added ? "✓ Added to cart" : "Add to cart"}
      </button>
      {added && <Link href="/checkout" style={{ fontSize: 12.5, fontWeight: 700, color: "#4E5BDC" }}>Checkout →</Link>}
    </div>
  );
}
