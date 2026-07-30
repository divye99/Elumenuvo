import type { Metadata } from "next";
import OrderConfirmedClient from "./OrderConfirmedClient";

/**
 * The purchase-conversion URL. A customer only lands here after a verified
 * payment (checkout redirects with the order stashed in sessionStorage), the
 * GA4 purchase event fires here with the real order value, and this exact URL
 * - https://elumenuvo.com/order-confirmed - is what you register in Google as
 * the conversion destination.
 *
 * Landing here directly (no order in the session) shows a friendly fallback
 * and fires NOTHING, so stray visits and bots cannot mint fake conversions.
 */
export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false }, // a receipt page has no business in Google
};

export default function OrderConfirmedPage() {
  return <OrderConfirmedClient />;
}
