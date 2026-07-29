"use client";

import { useEffect } from "react";

/**
 * Google Customer Reviews BADGE — the second half of the programme.
 *
 * The opt-in (GoogleReviewOptIn, on the order-confirmed screen) collects
 * ratings; this shows the resulting seller rating on the site. Google renders
 * nothing until the account has enough reviews, so it is safe to ship early:
 * it simply appears once the ratings exist.
 *
 * It is also one of the trust signals Merchant Center's misrepresentation
 * check looks for ("highlight any badges or seals of approval"), which is why
 * it sits on every page rather than only on checkout.
 */

const MERCHANT_ID = 5827864189;

export default function GoogleReviewBadge() {
  useEffect(() => {
    const CONTAINER_ID = "elume-gcr-badge";
    if (document.getElementById(CONTAINER_ID)) return; // already mounted

    const container = document.createElement("div");
    container.id = CONTAINER_ID;
    document.body.appendChild(container);

    const render = () => {
      window.gapi?.load("ratingbadge", () => {
        window.gapi?.ratingbadge?.render(container, { merchant_id: MERCHANT_ID, position: "BOTTOM_LEFT" });
      });
    };

    // platform.js may already be present from the checkout opt-in.
    if (window.gapi) { render(); return; }
    window.renderBadge = render;
    if (document.querySelector('script[src^="https://apis.google.com/js/platform.js"]')) return;
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/platform.js?onload=renderBadge";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  return null;
}
