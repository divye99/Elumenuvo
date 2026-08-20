"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/data";

/**
 * Lands a shared cart link (built in /admin/cart-links): puts the linked
 * items in the shopper's cart and forwards them to /cart to check out.
 *
 * - Prices are NOT in the link. They come from the live catalogue at open
 *   time, so a link sent on Monday charges Wednesday's price.
 * - A localStorage receipt keyed on the link's contents makes the add
 *   once-only: refreshing, or tapping the WhatsApp link twice, never
 *   doubles the quantities.
 * - Items that went inactive or out of stock since the link was written are
 *   reported instead of silently dropped.
 */
export default function CartLinkClient({ items, missing, src }: { items: { p: Product; qty: number }[]; missing: number; src?: string }) {
  const cart = useCart();
  const router = useRouter();
  const ran = useRef(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!cart.ready || ran.current) return;
    ran.current = true;
    const key = "elume.cartlink." + items.map((i) => `${i.p.id}:${i.qty}`).join(",");
    let fresh = true;
    try {
      fresh = !localStorage.getItem(key);
      if (fresh) localStorage.setItem(key, String(Date.now()));
    } catch { /* private mode: adding twice is the lesser evil */ }
    if (fresh) {
      for (const { p, qty } of items) {
        cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image }, qty);
      }
      track("cart_link_open", { detail: { items: items.length, missing, src: src ?? "direct" } });
    }
    setSettled(true);
    // All good → straight to the cart. Something missing → stay and say so.
    if (missing === 0 && items.length > 0) router.replace("/cart");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.ready]);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "70px 20px 90px", textAlign: "center" }}>
      {!settled ? (
        <>
          <div style={{ fontSize: 26, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: "#19202E" }}>Preparing your cart…</div>
        </>
      ) : items.length === 0 ? (
        <>
          <div style={{ fontSize: 26, marginBottom: 12 }}>🛒</div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: "#19202E" }}>This cart link has expired</div>
          <p style={{ fontSize: 13.5, color: "#56627A", lineHeight: 1.6, margin: "10px 0 22px" }}>
            The items in it are no longer available. Browse the catalogue, or reply to us on WhatsApp and
            we will send you a fresh link.
          </p>
          <Link href="/catalogue" style={{ display: "inline-block", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 10 }}>
            Browse the catalogue
          </Link>
        </>
      ) : (
        <>
          <div style={{ fontSize: 26, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 16.5, fontWeight: 700, color: "#19202E" }}>
            {items.length} item{items.length === 1 ? "" : "s"} added to your cart
          </div>
          <p style={{ fontSize: 13.5, color: "#C77700", lineHeight: 1.6, margin: "10px 0 22px" }}>
            {missing} item{missing === 1 ? " from this link is" : "s from this link are"} no longer available and
            {missing === 1 ? " was" : " were"} skipped.
          </p>
          <Link href="/cart" style={{ display: "inline-block", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 10 }}>
            Review cart and checkout →
          </Link>
        </>
      )}
    </div>
  );
}
