"use client";

import { useState } from "react";

/** Drops the shared catalogue cache (six-hour window) on demand. For changes
 *  made outside the admin console: raw SQL, backfill scripts. Admin writes
 *  inside the console never need this; they revalidate on their own. */
export default function RefreshCatalogueButton() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const run = async () => {
    setState("busy");
    try {
      const r = await fetch("/api/admin/revalidate", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setState(d?.ok ? "done" : "failed");
    } catch {
      setState("failed");
    }
  };
  const label = state === "busy" ? "Refreshing..." : state === "done" ? "Storefront cache refreshed" : state === "failed" ? "Refresh failed, try again" : "Refresh storefront cache";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={run}
        disabled={state === "busy"}
        style={{ background: state === "done" ? "#1F9D63" : "#1D2F8A", color: "#fff", border: 0, borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: state === "busy" ? "wait" : "pointer" }}
      >
        {label}
      </button>
      <span style={{ fontSize: 12.5, color: "#6B7280" }}>
        Only after SQL or script changes to products. Console edits are live on their own; the cache otherwise refreshes every six hours.
      </span>
    </div>
  );
}
