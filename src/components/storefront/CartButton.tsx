"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

/** Header cart icon with a live item-count badge. */
export default function CartButton() {
  const { count } = useCart();
  return (
    <Link href="/cart" style={{ position: "relative", display: "inline-flex", alignItems: "center", fontSize: 20, color: "#19202E", textDecoration: "none" }} aria-label="Cart">
      🛒
      {count > 0 && (
        <span style={{ position: "absolute", top: -6, right: -8, background: "#4E5BDC", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {count}
        </span>
      )}
    </Link>
  );
}
