"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track, flushNow } from "@/lib/analytics";

/**
 * Mounted once in the root layout. Records, per visitor:
 *  - every pageview (with referrer + UTM on landing)
 *  - time spent on each page (a `leave` event when the path changes or the
 *    tab hides, carrying duration_ms)
 *  - every click on a link or button (product taps and add-to-cart get their
 *    own types so journeys read cleanly)
 * The admin area is never tracked.
 */
export default function SiteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const pageStart = useRef<number>(Date.now());
  const lastPath = useRef<string | null>(null);
  const landed = useRef(false);

  /* ── pageviews + time-on-page ── */
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const now = Date.now();
    if (lastPath.current && lastPath.current !== pathname) {
      track("leave", { path: lastPath.current, duration_ms: Math.min(now - pageStart.current, 30 * 60_000) });
    }
    pageStart.current = now;
    lastPath.current = pathname;

    const detail: Record<string, unknown> = {};
    if (!landed.current) {
      landed.current = true;
      if (document.referrer && !document.referrer.includes(location.host)) detail.referrer_landing = document.referrer;
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid"]) {
        const v = search.get(k);
        if (v) detail[k] = v;
      }
    }
    track("pageview", { referrer: document.referrer || undefined, detail: Object.keys(detail).length ? detail : undefined });
  }, [pathname, search]);

  /* ── clicks, product taps, add-to-cart ── */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const el = (e.target as HTMLElement)?.closest?.("a[href], button");
        if (!el) return;
        const label = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 90);
        const href = el.getAttribute("href") || undefined;
        const pm = href?.match(/^\/catalogue\/([^/?#]+)/);
        if (pm) track("product_click", { detail: { product_id: pm[1], label } });
        else if (/add.*(cart|basket)/i.test(label)) track("add_to_cart", { detail: { label } });
        else track("click", { detail: { label, ...(href ? { href } : {}) } });
      } catch { /* ignore */ }
    };
    const onHide = () => {
      if (lastPath.current && !lastPath.current.startsWith("/admin")) {
        track("leave", { path: lastPath.current, duration_ms: Math.min(Date.now() - pageStart.current, 30 * 60_000) });
      }
      flushNow();
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") onHide(); });
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, { capture: true } as any);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
