"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveCheckoutDraft } from "@/lib/checkout-draft";
import { splitE164ForDraft } from "@/lib/reorder";
import type { LiveOrder } from "@/lib/workspace";

/**
 * Repeat an order in two taps: "Buy it again" here, then "Pay" at checkout.
 *
 * Everything that made the first order is restored, not just the items: the
 * same delivery and billing address, the same GSTIN and the same phone, laid
 * into the checkout draft so the form arrives filled. Prices are deliberately
 * NOT carried over; checkout re-prices every line from the database, so a
 * repeat order is charged at today's rate, never a stale one.
 *
 * The cart is written straight to localStorage rather than through the cart
 * context, because this button renders inside the workspace shell, which is
 * outside the storefront CartProvider.
 */
const CART_KEY = "elume.cart";

export default function BuyAgainButton({ order, compact = false }: { order: LiveOrder; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const buyable = order.lines.filter((l) => l.id);

  if (buyable.length === 0) return null;

  const go = () => {
    setBusy(true);
    try {
      // Merge into whatever is already in the cart, taking the higher quantity
      // per line, so this never silently discards something already added.
      type CartRow = Record<string, unknown> & { id: string; qty?: number };
      let existing: CartRow[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        if (Array.isArray(parsed)) existing = parsed.filter((i): i is CartRow => !!i && typeof i.id === "string");
      } catch { /* fresh cart */ }

      const byId = new Map<string, CartRow>(existing.map((i) => [i.id, i]));
      for (const l of buyable) {
        const prev = byId.get(l.id);
        byId.set(l.id, prev
          ? { ...prev, qty: Math.max(Number(prev.qty ?? 1), l.qty) }
          : { id: l.id, name: l.name, qty: l.qty, price: l.price, brand: "", mrp: l.price, unit: "pc" });
      }
      localStorage.setItem(CART_KEY, JSON.stringify([...byId.values()]));

      // Restore the delivery setup this order used.
      const ship = order.addressDetails?.shipping;
      const bill = order.addressDetails?.billing;
      if (ship || bill || order.gstin || order.phone) {
        const ph = splitE164ForDraft(order.phone ?? "");
        saveCheckoutDraft({
          name: order.name ?? "",
          email: "",
          phone: ph.national,
          iso: ph.iso,
          gstin: order.gstin ?? "",
          wantGst: !!order.gstin,
          // Two blocks were stored separately only when they actually differed.
          sameAsBilling: !ship || !bill || JSON.stringify(ship) === JSON.stringify(bill),
          billing: (bill ?? ship ?? {}) as Record<string, string>,
          shipping: (ship ?? bill ?? {}) as Record<string, string>,
        });
      }
      router.push("/checkout");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={go}
      disabled={busy}
      style={{
        background: compact ? "#fff" : "#1D2F8A",
        color: compact ? "#1D2F8A" : "#fff",
        border: compact ? "1px solid #C9D0F5" : "none",
        fontWeight: 700, fontSize: 13, borderRadius: 9,
        padding: compact ? "7px 13px" : "10px 18px",
        cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {busy ? "Adding…" : "Buy it again"}
    </button>
  );
}
