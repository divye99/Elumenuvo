"use client";

/** Fire-and-forget search logging (stage 1 of query-driven suggestions).
 *  sendBeacon survives the navigation that a search or suggestion click
 *  triggers; fetch keepalive is the fallback. Never throws, never blocks. */

const SID_KEY = "elume.sid";

function sid(): string | null {
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

export function logSearch(payload: { q: string; source: "search" | "suggest"; results?: number; picked?: string; cat?: string }) {
  try {
    const body = JSON.stringify({ ...payload, sid: sid() });
    if (navigator.sendBeacon?.("/api/search-log", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/search-log", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    /* logging must never break search */
  }
}
