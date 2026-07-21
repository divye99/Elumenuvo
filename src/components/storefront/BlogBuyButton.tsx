"use client";

/**
 * Buy box for a ranked item in a top-10 blog post: product photo, live Elume
 * price vs MRP and one-tap add to cart, so a reader can buy straight from
 * the list. Rendered only for items mapped to a product we actually stock.
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
    setTimeout(() => setAdded(false), 2600);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 14, background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
      {/* Photo links to the product page */}
      <Link href={`/catalogue/${product.id}`} style={{ flexShrink: 0 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, background: "#fff", border: "1px solid #EEF0F4", borderRadius: 12, overflow: "hidden" }}>
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt={product.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 6, boxSizing: "border-box" }} />
          ) : (
            <span style={{ fontSize: 30 }}>🔌</span>
          )}
        </span>
      </Link>

      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, color: "#8A93A6", marginBottom: 2 }}>Available on Elume</div>
        <Link href={`/catalogue/${product.id}`} style={{ display: "block", fontSize: 14.5, fontWeight: 700, color: "#19202E", lineHeight: 1.35 }}>
          {product.name}
        </Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, marginTop: 5, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 19, color: "#19202E" }}>{fmt(product.price)}</span>
          {off > 0 && (
            <>
              <span style={{ fontSize: 13, color: "#A0A7B5", textDecoration: "line-through" }}>{fmt(product.market)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1F9D63" }}>{off}% off</span>
            </>
          )}
          <span style={{ fontSize: 11.5, color: "#8A93A6" }}>/ {product.unit} · incl. GST</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <button
          onClick={onAdd}
          style={{ background: added ? "#1F9D63" : "#19202E", color: "#fff", border: "none", borderRadius: 10, padding: "12px 22px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", transition: "background .2s", whiteSpace: "nowrap" }}
        >
          {added ? "✓ Added to cart" : "Add to cart"}
        </button>
        {added && <Link href="/checkout" style={{ fontSize: 12.5, fontWeight: 700, color: "#4E5BDC" }}>Checkout →</Link>}
      </div>
    </div>
  );
}
