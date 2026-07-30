"use client";

import { useState } from "react";

/**
 * "View their workspace" - mints a one-time sign-in link for this customer
 * (admin-gated server route) and opens it in a new tab. The tab is signed in
 * AS the customer, with full ability to act, exactly what support needs.
 *
 * The confirm step exists because this replaces the storefront session in
 * whatever browser profile the tab opens in: best opened from a private
 * window, and always sign out of their account when done.
 */
export default function ImpersonateButton({ email, name }: { email: string; name: string | null }) {
  const [state, setState] = useState<"idle" | "confirm" | "working" | "err">("idle");
  const [err, setErr] = useState("");

  const go = async () => {
    setState("working");
    try {
      const r = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Failed."); setState("err"); return; }
      window.open(d.link, "_blank", "noopener");
      setState("idle");
    } catch {
      setErr("Network hiccup - try again."); setState("err");
    }
  };

  if (state === "confirm" || state === "working") {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <button
          disabled={state === "working"}
          onClick={go}
          style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#B4690E", border: "none", padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}
        >
          {state === "working" ? "Creating link..." : `Sign in as ${name || email}?`}
        </button>
        <button onClick={() => setState("idle")} style={{ fontSize: 11, fontWeight: 700, color: "#8A93A6", background: "none", border: "none", cursor: "pointer" }}>
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <button
        onClick={() => { setErr(""); setState("confirm"); }}
        title="Opens a one-time sign-in link for this customer in a new tab. You will BE them - use a private window and sign out when done."
        style={{ fontSize: 11, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FE", border: "none", padding: "4px 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
      >
        👁 View their workspace
      </button>
      {state === "err" && <span style={{ fontSize: 10.5, color: "#B43A16" }}>{err}</span>}
    </span>
  );
}
