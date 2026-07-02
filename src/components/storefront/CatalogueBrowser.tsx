"use client";

import { useMemo, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import { GROTESK } from "@/lib/fonts";
import { CATS, type Product } from "@/lib/data";

/** Public catalogue browser — search + category + brand filters over a product
 *  list supplied by the server (read from Supabase, static fallback). Initial
 *  search/category arrive via URL params so the home page can deep-link. */
export default function CatalogueBrowser({
  products,
  initialQ = "",
  initialCat = "All",
}: {
  products: Product[];
  initialQ?: string;
  initialCat?: string;
}) {
  const [cat, setCat] = useState(CATS.includes(initialCat) ? initialCat : "All");
  const [brand, setBrand] = useState("All");
  const [q, setQ] = useState(initialQ);

  const brands = useMemo(
    () => ["All", ...Array.from(new Set(products.map((p) => p.brand))).sort()],
    [products]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p) => {
      const inCat = cat === "All" || p.cat === cat;
      const inBrand = brand === "All" || p.brand === brand;
      const inSearch =
        !needle ||
        `${p.brand} ${p.name} ${p.spec} ${p.sku} ${p.cat}`.toLowerCase().includes(needle);
      return inCat && inBrand && inSearch;
    });
  }, [products, cat, brand, q]);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 56px" }}>
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
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 10px" }}>
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

      {/* Brand chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "0 0 24px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4px", color: "#8A93A6", textTransform: "uppercase", marginRight: 4 }}>Brand</span>
        {brands.map((label) => {
          const active = brand === label;
          return (
            <button
              key={label}
              onClick={() => setBrand(label)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 13px",
                borderRadius: 20,
                cursor: "pointer",
                background: active ? "#4E5BDC" : "#fff",
                color: active ? "#fff" : "#56627A",
                border: `1px solid ${active ? "#4E5BDC" : "#E8EBF1"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, color: "#8A93A6", marginBottom: 14 }}>
        {filtered.length} product{filtered.length === 1 ? "" : "s"}
      </div>

      {/* Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        {filtered.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </main>
  );
}
