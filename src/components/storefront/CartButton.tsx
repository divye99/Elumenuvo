"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

/** Header cart button - a solid stroked trolley (the emoji read as a toy),
 *  with the live item-count badge. */
export default function CartButton() {
  const { count } = useCart();
  return (
    <Link href="/cart" style={{ position: "relative", display: "inline-flex", alignItems: "center", color: "#19202E", textDecoration: "none" }} aria-label="Cart">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="20" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="20" r="1.6" fill="currentColor" stroke="none" />
        <path d="M2.5 3.5h2.6l2.3 11.2a1.6 1.6 0 0 0 1.57 1.3h8.6a1.6 1.6 0 0 0 1.56-1.22L21.5 7.5H6.1" />
      </svg>
      {count > 0 && (
        <span style={{ position: "absolute", top: -6, right: -8, background: "#1D2F8A", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17, padding: "0 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {count}
        </span>
      )}
    </Link>
  );
}
