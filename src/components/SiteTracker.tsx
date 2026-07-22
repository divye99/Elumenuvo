"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track, flushNow, setOptOut } from "@/lib/analytics";

/**
 * Mounted once in the root layout. Records, per visitor:
 *  - every pageview (with referrer + UTM on landing)
 *  - time spent on each page (a `leave` event when the path changes or the
 *    tab hides, carrying duration_ms)
 *  - every click on a link or button (product taps and add-to-cart get their
 *    own types so journeys read cleanly)
 *  - every typed form field on blur/submit (`input` events) — EXCEPT
 *    passwords, OTPs and card fields, which are never recorded
 * The admin area is never tracked.
 */

/** Fields whose values must never be captured. */
function isSensitiveField(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (el instanceof HTMLInputElement && el.type === "password") return true;
  const hint = `${el.name} ${el.id} ${el.getAttribute("placeholder") ?? ""} ${el.getAttribute("autocomplete") ?? ""}`.toLowerCase();
  return /password|passcode|otp|one.?time|cvv|cvc|card.?number|cc-/.test(hint);
}

/** A stable, readable label for the field ("Email", "phone", "gstin"…). */
function fieldLabel(el: HTMLInputElement | HTMLTextAreaElement): string {
  return (el.getAttribute("placeholder") || el.name || el.id || el.getAttribute("aria-label") || (el instanceof HTMLInputElement ? el.type : "text")).slice(0, 60);
}
export default function SiteTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const pageStart = useRef<number>(Date.now());
  const lastPath = useRef<string | null>(null);
  const landed = useRef(false);

  /* ── owner/device opt-out ──
     Opening the admin marks this browser as the owner's, permanently
     excluding it from analytics. ?notrack=1 does the same for devices that
     never open the admin (e.g. the owner's phone); ?notrack=0 re-enables. */
  useEffect(() => {
    if (pathname.startsWith("/admin")) setOptOut(true);
    const nt = search.get("notrack");
    if (nt === "1") setOptOut(true);
    if (nt === "0") setOptOut(false);
  }, [pathname, search]);

  /* ── typed inputs: anything entered anywhere is data (blur + submit).
        Dedupes per field so tabbing back and forth doesn't spam. ── */
  const lastTyped = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const capture = (el: Element | null) => {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (window.location.pathname.startsWith("/admin")) return;
      if (el instanceof HTMLInputElement) {
        if (el.type === "hidden" || el.type === "submit" || el.type === "button") return;
        if ((el.type === "radio" || el.type === "checkbox") && !el.checked) return;
      }
      // Framework plumbing (Next server-action fields like $ACTION_KEY) is not user input.
      if ((el.name ?? "").startsWith("$")) return;
      if (isSensitiveField(el)) return;
      const value = el.value.trim().slice(0, 300);
      if (!value) return;
      const label = fieldLabel(el);
      const key = `${window.location.pathname}|${label}`;
      if (lastTyped.current.get(key) === value) return;
      lastTyped.current.set(key, value);
      track("input", { path: window.location.pathname, detail: { label, value } });
    };
    const onBlur = (e: FocusEvent) => capture(e.target as Element);
    const onSubmit = (e: Event) => {
      const form = e.target as HTMLFormElement | null;
      if (!form?.querySelectorAll) return;
      form.querySelectorAll("input, textarea").forEach((el) => capture(el));
      flushNow(); // submits often navigate — don't lose the batch
    };
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

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
        const ms = Date.now() - pageStart.current;
        // Reset the stopwatch so a laptop sleeping/waking overnight doesn't
        // report the same idle stretch as multiple capped 30-minute blocks.
        pageStart.current = Date.now();
        if (ms >= 1000) track("leave", { path: lastPath.current, duration_ms: Math.min(ms, 30 * 60_000) });
      }
      flushNow();
    };
    const onShow = () => { pageStart.current = Date.now(); }; // resume: time only counts while visible
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") onHide(); else onShow(); });
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, { capture: true } as any);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  return null;
}
