"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HealthCheckNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await fetch("/api/admin/health", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      setNote(d?.row ? `${String(d.row.status).toUpperCase()}${d.row.note ? ": " + d.row.note : ""}` : "Check failed.");
      router.refresh();
    } catch {
      setNote("Check failed.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button type="button" onClick={run} disabled={busy} style={{ background: "#1D2F8A", color: "#fff", border: 0, borderRadius: 10, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Checking..." : "Check now"}
      </button>
      {note && <span style={{ fontSize: 13, color: "#2c3550" }}>{note}</span>}
    </div>
  );
}
