"use client";

import { useEffect } from "react";

/**
 * Google Customer Reviews opt-in (Merchant Center programme). Renders Google's
 * own consent dialog on the order-confirmed screen; if the customer opts in,
 * Google emails them a review survey after the estimated delivery date.
 * The dialog is entirely Google-hosted: we only pass the order facts.
 */

const MERCHANT_ID = 5827864189;

// We promise pan-India delivery in 3 to 7 working days. The survey must land
// AFTER the parcel does, so estimate at the generous end: 9 calendar days.
const DELIVERY_DAYS = 9;

declare global {
  interface Window {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
      surveyoptin: { render: (opts: Record<string, unknown>) => void };
    };
    renderOptIn?: () => void;
  }
}

export default function GoogleReviewOptIn({ orderId, email }: { orderId: string; email: string }) {
  useEffect(() => {
    if (!orderId || !email.trim()) return;

    const estimated = new Date(Date.now() + DELIVERY_DAYS * 86_400_000).toISOString().slice(0, 10);
    const render = () => {
      window.gapi?.load("surveyoptin", () => {
        window.gapi?.surveyoptin.render({
          merchant_id: MERCHANT_ID,
          order_id: orderId,
          email: email.trim(),
          delivery_country: "IN",
          estimated_delivery_date: estimated,
        });
      });
    };

    // platform.js may already be on the page from an earlier order this session.
    if (window.gapi) { render(); return; }
    window.renderOptIn = render;
    if (document.querySelector('script[src^="https://apis.google.com/js/platform.js"]')) return; // still loading; onload callback will fire
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/platform.js?onload=renderOptIn";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, [orderId, email]);

  return null;
}
