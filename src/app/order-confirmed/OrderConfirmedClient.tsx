"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { readOrder, trackPurchase, type PurchasePayload } from "@/lib/gtag";
import GoogleReviewOptIn from "@/components/GoogleReviewOptIn";

/** The confirmation screen (moved here from checkout so it lives on a real
 *  URL): celebration card, track/continue buttons, Google review opt-in, and
 *  the guest account nudge. Fires the GA4 purchase event exactly once. */
export default function OrderConfirmedClient() {
  const [order, setOrder] = useState<PurchasePayload | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const o = readOrder();
    if (o) trackPurchase(o);
    setOrder(o);
    setChecked(true);
  }, []);

  if (!checked) return null;

  if (!order) {
    // Direct visit with no order in this session: no event, no fake data.
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 28px", textAlign: "center" }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, margin: "0 0 10px" }}>Looking for an order?</h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 20px" }}>
          Your confirmation email has everything, and you can follow any order with its ID and your email address.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Link href="/track" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Track an order</Link>
          <Link href="/catalogue" style={{ background: "#EEF0FE", color: "#4E5BDC", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Browse the catalogue</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 28px" }}>
      {/* Google Customer Reviews: Google's own opt-in dialog for a post-delivery review survey */}
      <GoogleReviewOptIn orderId={order.orderId} email={order.email} />
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "40px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>Order confirmed</h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 4px" }}>Order <b>{order.orderId}</b> · {fmt(order.total)} paid</p>
        <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 20px" }}>We&apos;ve got it - a confirmation is on its way to {order.email}. Pan-India delivery in 3–7 working days.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href={`/track?order=${encodeURIComponent(order.orderId)}&email=${encodeURIComponent(order.email)}`} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Track order</Link>
          <Link href="/catalogue" style={{ background: "#EEF0FE", color: "#4E5BDC", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Continue shopping</Link>
        </div>
      </div>

      {/* Guests: nudge them to create an account so the order lands in their dashboard */}
      {!order.signedIn && (
        <div style={{ marginTop: 16, background: "linear-gradient(135deg,#EEF0FE,#F7F8FB)", border: "1px solid #D9DDFB", borderRadius: 16, padding: "24px 26px" }}>
          <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E" }}>Create an account to track this order</div>
          <p style={{ fontSize: 13, color: "#56627A", lineHeight: 1.6, margin: "6px 0 14px" }}>
            We&apos;ll link order <b>{order.orderId}</b> to <b>{order.email}</b> so you can follow it to your door, and never re-type your address again.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px", marginBottom: 16 }}>
            {[
              ["📦", "Track every order in one place"],
              ["⚡", "One-tap checkout next time"],
              ["🧾", "All your GST invoices, downloadable"],
              ["💰", "Wholesale rates + 30-day credit when it launches"],
            ].map(([icon, text]) => (
              <div key={text} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4358" }}>
                <span>{icon}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
          <Link
            href={`/signin?mode=signup&email=${encodeURIComponent(order.email)}`}
            style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 11 }}
          >
            Create my account →
          </Link>
          <span style={{ fontSize: 11.5, color: "#8A93A6", marginLeft: 12 }}>Takes 20 seconds. Your order is safe either way.</span>
        </div>
      )}
    </main>
  );
}
