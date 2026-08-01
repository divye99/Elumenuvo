"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";

/**
 * PDP drop-off telemetry. Watches every element tagged data-pdp-sec and
 * fires ONE pdp_section event per section per pageview the first time it
 * becomes meaningfully visible (35% in view). Together the events say how
 * far down the product page each visitor actually got - the section funnel
 * behind the admin "Product page" analytics tab.
 *
 * Incremental by design (an event per section as it appears, not a summary
 * on exit): a closed tab mid-scroll still leaves the truth behind.
 */
export default function PdpTelemetry({ pid }: { pid: string }) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-pdp-sec]"));
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const fired = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          const sec = (en.target as HTMLElement).dataset.pdpSec;
          if (!sec || fired.has(sec)) continue;
          fired.add(sec);
          track("pdp_section", { detail: { sec, pid } });
          io.unobserve(en.target);
        }
      },
      { threshold: 0.35 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pid]);
  return null;
}
