"use client";

import { useRouter } from "next/navigation";
import type { Product } from "@/lib/data";
import { dimsOf, valuesOf, bestMatch, COLOUR_HEX } from "@/lib/variants";

/**
 * Variant selector — siblings share a variant_group and differ by attrs
 * (Size / Colour / Length / Quality…). Picking a value navigates to the
 * sibling that matches it best, so price/SKU/stock update naturally.
 */
export default function VariantPicker({ p, siblings }: { p: Product; siblings: Product[] }) {
  const router = useRouter();
  if (!p.attrs || siblings.length < 2) return null;

  const dims = dimsOf(siblings);

  const pick = (dim: string, value: string) => {
    const best = bestMatch(p, siblings, dim, value);
    if (best && best.id !== p.id) router.push(`/catalogue/${best.id}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "2px 0 18px" }}>
      {dims.map((dim) => {
        const values = valuesOf(siblings, dim);
        if (values.length < 2) return null;
        return (
          <div key={dim}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 7 }}>
              {dim}: <span style={{ color: "#19202E", textTransform: "none" }}>{p.attrs?.[dim]}</span>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {values.map((v) => {
                const active = p.attrs?.[dim] === v;
                const hex = dim === "Colour" ? COLOUR_HEX[v] : undefined;
                return (
                  <button
                    key={v}
                    onClick={() => pick(dim, v)}
                    title={v}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
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
                    {hex && (
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: "50%",
                          background: hex,
                          border: "1px solid rgba(0,0,0,0.15)",
                          display: "inline-block",
                        }}
                      />
                    )}
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
