"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Amazon-style header search — submits into the catalogue with ?q=. */
export default function HeaderSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = () => {
    const needle = q.trim();
    router.push(needle ? `/catalogue?q=${encodeURIComponent(needle)}` : "/catalogue");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      style={{
        flex: 1,
        minWidth: 170,
        maxWidth: compact ? 420 : 560,
        display: "flex",
        alignItems: "center",
        background: "#F3F5F9",
        border: "1px solid #E8EBF1",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <span style={{ padding: "0 4px 0 14px", color: "#A0A7B5", fontSize: 15 }}>⌕</span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search wires, MCBs, fans, switches, brands…"
        style={{
          border: "none",
          outline: "none",
          fontSize: 14,
          width: "100%",
          padding: "10px 10px",
          background: "transparent",
          color: "#19202E",
        }}
      />
      <button
        type="submit"
        aria-label="Search"
        style={{
          border: "none",
          cursor: "pointer",
          background: "#4E5BDC",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          padding: "10px 18px",
        }}
      >
        Search
      </button>
    </form>
  );
}
