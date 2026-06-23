"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { PRODUCTS, CATS, tileFor } from "@/lib/data";

export default function CataloguePage() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");

  const products = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      const inCat = cat === "All" || p.cat === cat;
      const inSearch =
        !needle ||
        `${p.brand} ${p.name} ${p.spec} ${p.sku} ${p.cat}`.toLowerCase().includes(needle);
      return inCat && inSearch;
    });
  }, [cat, q]);

  return (
    <main style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 28px 56px" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 32, fontWeight: 600, letterSpacing: "-0.8px", margin: 0 }}>
          The FMEG catalogue
        </h1>
        <p style={{ fontSize: 15, color: "#56627A", margin: "8px 0 0", maxWidth: 640 }}>
          Every major brand in one place — wires, switchgear, lighting, fans and more. Each shows
          the MRP, our Elume price, and a wholesale rate at 15+ units.
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "#fff",
          border: "1px solid #E8EBF1",
          borderRadius: 12,
          padding: "12px 16px",
          maxWidth: 560,
          boxShadow: "0 6px 18px rgba(20,24,45,.05)",
        }}
      >
        <span style={{ color: "#A0A7B5" }}>⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search wires, MCBs, fans, panels, brands…"
          style={{ border: "none", outline: "none", fontSize: 15, width: "100%", background: "transparent", color: "#19202E" }}
        />
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 24px" }}>
        {CATS.map((label) => {
          const active = cat === label;
          return (
            <button
              key={label}
              onClick={() => setCat(label)}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                padding: "8px 15px",
                borderRadius: 20,
                cursor: "pointer",
                background: active ? "#19202E" : "#fff",
                color: active ? "#fff" : "#56627A",
                border: `1px solid ${active ? "#19202E" : "#E8EBF1"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, color: "#8A93A6", marginBottom: 14 }}>
        {products.length} product{products.length === 1 ? "" : "s"}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {products.map((p) => {
          const save = Math.round((1 - p.price / p.market) * 100) + "%";
          return (
            <Link
              key={p.id}
              href={`/catalogue/${p.id}`}
              style={{
                background: "#fff",
                border: "1px solid #E8EBF1",
                borderRadius: 14,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ height: 150, position: "relative" }}>
                <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} />
                <span style={{ position: "absolute", left: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, color: "#6b748c", background: "rgba(255,255,255,0.88)", padding: "3px 6px", borderRadius: 5 }}>{p.sku}</span>
                <span style={{ position: "absolute", right: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontSize: 11, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "4px 8px", borderRadius: 6 }}>↓ {save}</span>
              </div>
              <div style={{ padding: "15px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
                  <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{p.brand}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6", marginBottom: 13 }}>{p.spec}</div>
                <div style={{ marginTop: "auto" }}>
                  <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E" }}>{fmt(p.price)}</div>
                  <div style={{ fontSize: 11.5, color: "#A0A7B5" }}>MRP <span style={{ textDecoration: "line-through" }}>{fmt(p.market)}</span></div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
