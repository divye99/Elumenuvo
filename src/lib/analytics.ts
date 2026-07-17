"use client";

/**
 * First-party visitor analytics (client half). Batches events and ships them
 * to /api/track with sendBeacon (survives navigation) or keepalive fetch.
 * Keyed by the same anonymous device token as the search log, so search
 * queries and browsing line up as one journey in the admin. Never throws,
 * never blocks the shopper.
 */

const SID_KEY = "elume.sid";

export function sid(): string | null {
  try {
    let s = localStorage.getItem(SID_KEY);
    if (!s) {
      s = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      localStorage.setItem(SID_KEY, s);
    }
    return s;
  } catch {
    return null;
  }
}

type Ev = { type: string; path: string; detail?: Record<string, unknown>; referrer?: string; duration_ms?: number; email?: string; name?: string; ts: number };

let queue: Ev[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const batch = queue.splice(0, 25);
  try {
    const body = JSON.stringify({ sid: sid(), events: batch });
    if (navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/track", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch { /* analytics must never break the site */ }
}

export function track(type: string, extra?: Partial<Omit<Ev, "type" | "ts">>) {
  try {
    if (location.pathname.startsWith("/admin")) return; // never track the admin
    queue.push({ type, path: location.pathname + location.search, ts: Date.now(), ...extra });
    if (queue.length >= 20) flush();
    else if (!timer) timer = setTimeout(flush, 4000);
  } catch { /* ignore */ }
}

/** Attach a real identity to this device's history (checkout, signup, waitlist). */
export function identify(email?: string | null, name?: string | null) {
  const e = (email ?? "").trim();
  if (!e) return;
  track("identify", { email: e.slice(0, 200), name: (name ?? "").trim().slice(0, 140) || undefined });
  flush();
}

export function flushNow() { flush(); }
