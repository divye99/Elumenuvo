"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/data";

const DIM_ORDER = ["Size", "Colour", "Length", "Quality"];

/**
 * Variant selector — siblings share a variant_group and differ by attrs
 * (Size / Colour / Length / Quality…). Picking a value navigates to the
 * sibling that matches it best, so price/SKU/stock update naturally.
 */
export default function VariantPicker({ p, siblings }: { p: Product; siblings: Product[] }) {
  const router = useRouter();
  if (!p.attrs || siblings.length < 2) return null;

  const dims = Array.from(new Set(siblings.flatMap((s) => Object.keys(s.attrs ?? {})))).sort(
    (a, b) => {
      const ia = DIM_ORDER.indexOf(a);
      const ib = DIM_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
  );

  const pick = (dim: string, value: string) => {
    // Best match: has the requested value, then agrees with the current
    // selection on as many other dimensions as possible.
    const candidates = siblings.filter((s) => s.attrs?.[dim] === value);
    if (candidates.length === 0) return;
    const score = (s: Product) =>
      dims.reduce((n, d) => (d !== dim && s.attrs?.[d] === p.attrs?.[d] ? n + 1 : n), 0);
    const best = [...candidates].sort((a, b) => score(b) - score(a))[0];
    if (best.id !== p.id) router.push(`/catalogue/${best.id}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "2px 0 18px" }}>
      {dims.map((dim) => {
        const values = Array.from(
          new Set(siblings.map((s) => s.attrs?.[dim]).filter(Boolean) as string[])
        ).sort((a, b) => {
          const na = parseFloat(a);
          const nb = parseFloat(b);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a.localeCompare(b);
        });
        if (values.length < 2) return null;
        return (
          <div key={dim}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 7 }}>
              {dim}: <span style={{ color: "#19202E", textTransform: "none" }}>{p.attrs?.[dim]}</span>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {values.map((v) => {
                const active = p.attrs?.[dim] === v;
                const exists = siblings.some((s) => s.attrs?.[dim] === v);
                return (
                  <button
                    key={v}
                    onClick={() => pick(dim, v)}
                    disabled={!exists}
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "8px 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      background: active ? "#EEF0FE" : "#fff",
                      color: active ? "#4E5BDC" : "#3A4358",
                      border: `1.5px solid ${active ? "#4E5BDC" : "#E0E4ED"}`,
                    }}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
