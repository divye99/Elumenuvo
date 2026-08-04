"use client";

import { useEffect, useState } from "react";
import { GROTESK } from "@/lib/fonts";

/**
 * A product-page section that collapses ON MOBILE ONLY.
 *
 * Desktop is deliberately untouched: the body has no display rule above
 * 760px, so `open` is simply ignored there and every section renders exactly
 * as it always has. Only the phone gets a scannable list of headings.
 *
 * Two things this does NOT do, on purpose:
 *
 *  - It does not mount content on expand. Everything is server-rendered and
 *    present in the HTML from the first byte; collapsing is a CSS `display`
 *    rule. Google indexes the specs, the FAQ and the reviews whether or not a
 *    human ever taps the heading.
 *  - It does not use <details>/<summary>. `open` is a DOM attribute with one
 *    value, so a native details cannot be closed on a phone and open on a
 *    desktop without a hydration flash.
 *
 * TELEMETRY: `data-pdp-sec` sits on the BODY, not the card. A collapsed body
 * is display:none, which has no box, so the IntersectionObserver in
 * PdpTelemetry never reports it. Expanding gives it a box and the event fires
 * then. On mobile the funnel therefore measures "who chose to open this";
 * on desktop, where nothing is ever collapsed, it still measures "who
 * scrolled this far". No change to PdpTelemetry was needed.
 */
export default function PdpCollapse({
  title,
  sec,
  count,
  defaultOpen = false,
  openOnHash,
  children,
}: {
  title: string;
  /** data-pdp-sec value; goes on the body so collapsed sections stay unfired. */
  sec: string;
  /** Optional "· 12 options" style hint, readable while collapsed. */
  count?: string;
  defaultOpen?: boolean;
  /** Open automatically when the page is loaded with this hash. Reviews are
   *  deep-linked from the review-request email (…/catalogue/<id>#reviews);
   *  landing on a collapsed section would look like the reviews vanished. */
  openOnHash?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!openOnHash) return;
    const match = () => window.location.hash === `#${openOnHash}`;
    if (match()) setOpen(true);
    const onHash = () => { if (match()) setOpen(true); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [openOnHash]);

  return (
    <div className="pdp-card pdp-collapse" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
      <button
        className="pdp-collapse-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: "flex", alignItems: "baseline", gap: 10, width: "100%",
          background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "inherit",
        }}
      >
        <span style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px" }}>{title}</span>
        {count && <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{count}</span>}
        {/* Chevron is mobile-only: on desktop nothing collapses, so an
            affordance that does nothing would just be a lie. */}
        <span className="pdp-collapse-chev" style={{ marginLeft: "auto", fontSize: 12, color: "#8A93A6", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>
          ▾
        </span>
      </button>

      <div className="pdp-collapse-body" data-pdp-sec={sec} data-open={open ? "true" : "false"} style={{ marginTop: 12 }}>
        {children}
      </div>
    </div>
  );
}
