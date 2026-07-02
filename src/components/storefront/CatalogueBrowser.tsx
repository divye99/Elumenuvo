"use client";

import { useMemo, useRef, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import { GROTESK } from "@/lib/fonts";
import { CATS, type Product } from "@/lib/data";
import { groupVariants, familyKey } from "@/lib/variants";

const CAT_ICONS: Record<string, string> = {
  All: "◈",
  "Wires & Cables": "〰️",
  Switchgear: "⚡",
  Modular: "▣",
  Lighting: "💡",
  Fans: "🌀",
  "DB & Panels": "🗄️",
};

type Sort = "featured" | "recommended" | "top-sellers" | "top-rated" | "price-asc" | "price-desc" | "save-desc";
const SORTS: { key: Sort; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "recommended", label: "Recommended" },
  { key: "top-sellers", label: "Top sellers" },
  { key: "top-rated", label: "Top rated" },
  { key: "save-desc", label: "Biggest savings" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

/** Public catalogue browser — one sticky command bar (search · category pills ·
 *  brand + sort popovers) over the product grid. Initial search/category arrive
 *  via URL params so the home page can deep-link. */
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
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(initialQ);
  const [sort, setSort] = useState<Sort>("featured");
  const [open, setOpen] = useState<"cat" | "brand" | "sort" | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products]
  );
  const brandCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const p of products) m[p.brand] = (m[p.brand] ?? 0) + 1;
    return m;
  }, [products]);
  const catCount = useMemo(() => {
    const m: Record<string, number> = { All: products.length };
    for (const p of products) m[p.cat] = (m[p.cat] ?? 0) + 1;
    return m;
  }, [products]);
  const variantGroups = useMemo(() => groupVariants(products), [products]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = products.filter((p) => {
      const inCat = cat === "All" || p.cat === cat;
      const inBrand = picked.size === 0 || picked.has(p.brand);
      const inSearch =
        !needle ||
        `${p.brand} ${p.name} ${p.spec} ${p.sku} ${p.cat}`.toLowerCase().includes(needle);
      return inCat && inBrand && inSearch;
    });
    switch (sort) {
      case "recommended":
        return [...list].sort((a, b) => Number(b.recommended ?? false) - Number(a.recommended ?? false));
      case "top-sellers":
        return [...list].sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0));
      case "top-rated":
        return [...list].sort(
          (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
        );
      case "price-asc":
        return [...list].sort((a, b) => a.price - b.price);
      case "price-desc":
        return [...list].sort((a, b) => b.price - a.price);
      case "save-desc":
        return [...list].sort((a, b) => (1 - b.price / b.market) - (1 - a.price / a.market));
      default:
        return list;
    }
  }, [products, cat, picked, q, sort]);

  const toggleBrand = (b: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b);
      else next.add(b);
      return next;
    });

  const hasFilters = cat !== "All" || picked.size > 0 || q.trim() !== "" || sort !== "featured";
  const clearAll = () => {
    setCat("All");
    setPicked(new Set());
    setQ("");
    setSort("featured");
  };

  const popBtn = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 7,
    fontSize: 13,
    fontWeight: 600,
    padding: "9px 14px",
    borderRadius: 11,
    cursor: "pointer",
    whiteSpace: "nowrap",
    background: active ? "#EEF0FE" : "#fff",
    color: active ? "#4E5BDC" : "#3A4358",
    border: `1px solid ${active ? "#C9CFF6" : "#E8EBF1"}`,
  });

  const panel: React.CSSProperties = {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    zIndex: 50,
    background: "rgba(255,255,255,0.96)",
    backdropFilter: "blur(16px)",
    border: "1px solid #E8EBF1",
    borderRadius: 14,
    boxShadow: "0 18px 44px rgba(20,24,45,.14)",
    padding: 8,
    minWidth: 220,
  };

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 32, fontWeight: 600, letterSpacing: "-0.8px", margin: 0 }}>
          The FMEG catalogue
        </h1>
        <span style={{ fontSize: 13, color: "#8A93A6" }}>
          {filtered.length} of {products.length} products
        </span>
      </div>

      {/* ── Command bar ── */}
      <div
        style={{
          position: "sticky",
          top: 74,
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
          padding: 8,
          borderRadius: 16,
          background: "rgba(255,255,255,0.82)",
          backdropFilter: "blur(18px) saturate(160%)",
          WebkitBackdropFilter: "blur(18px) saturate(160%)",
          border: "1px solid #E8EBF1",
          boxShadow: "0 10px 30px rgba(20,24,45,.07)",
          marginBottom: 18,
        }}
      >
        {/* Search */}
        <div
          onClick={() => searchRef.current?.focus()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#F3F5F9",
            borderRadius: 11,
            padding: "9px 13px",
            minWidth: 180,
            flex: "1 1 200px",
            maxWidth: 320,
            cursor: "text",
          }}
        >
          <span style={{ color: "#A0A7B5", fontSize: 14 }}>⌕</span>
          <input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            style={{ border: "none", outline: "none", fontSize: 13.5, width: "100%", background: "transparent", color: "#19202E" }}
          />
          {q && (
            <span onClick={() => setQ("")} style={{ cursor: "pointer", color: "#A0A7B5", fontSize: 13 }}>
              ✕
            </span>
          )}
        </div>

        {/* Category popover */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(open === "cat" ? null : "cat")} style={popBtn(cat !== "All" || open === "cat")}>
            <span style={{ fontSize: 12 }}>{CAT_ICONS[cat]}</span>
            {cat === "All" ? "Category" : cat}
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>
          {open === "cat" && (
            <div style={{ ...panel, right: "auto", left: 0 }}>
              {CATS.map((label) => {
                const on = cat === label;
                return (
                  <button
                    key={label}
                    onClick={() => {
                      setCat(label);
                      setOpen(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      width: "100%",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "9px 11px",
                      borderRadius: 9,
                      cursor: "pointer",
                      border: "none",
                      textAlign: "left",
                      background: on ? "#EEF0FE" : "transparent",
                      color: on ? "#4E5BDC" : "#3A4358",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{CAT_ICONS[label]}</span>
                      {label === "All" ? "All categories" : label}
                    </span>
                    <span style={{ fontSize: 11.5, color: on ? "#8A93F0" : "#A0A7B5", fontWeight: 500 }}>{catCount[label] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {/* Brand popover */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(open === "brand" ? null : "brand")} style={popBtn(picked.size > 0 || open === "brand")}>
            Brand
            {picked.size > 0 && (
              <span style={{ background: "#4E5BDC", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: "1px 7px" }}>
                {picked.size}
              </span>
            )}
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>
          {open === "brand" && (
            <div style={{ ...panel, maxHeight: 340, overflowY: "auto" }}>
              {brands.map((b) => {
                const on = picked.has(b);
                return (
                  <button
                    key={b}
                    onClick={() => toggleBrand(b)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      width: "100%",
                      fontSize: 13,
                      fontWeight: 600,
                      padding: "9px 11px",
                      borderRadius: 9,
                      cursor: "pointer",
                      border: "none",
                      textAlign: "left",
                      background: on ? "#EEF0FE" : "transparent",
                      color: on ? "#4E5BDC" : "#3A4358",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 5,
                          border: `1.5px solid ${on ? "#4E5BDC" : "#C9CFDB"}`,
                          background: on ? "#4E5BDC" : "#fff",
                          color: "#fff",
                          fontSize: 10.5,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {on ? "✓" : ""}
                      </span>
                      {b}
                    </span>
                    <span style={{ fontSize: 11.5, color: "#A0A7B5", fontWeight: 500 }}>{brandCount[b]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sort popover */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(open === "sort" ? null : "sort")} style={popBtn(sort !== "featured" || open === "sort")}>
            ↕ {SORTS.find((s) => s.key === sort)?.label}
            <span style={{ fontSize: 10, opacity: 0.7 }}>▾</span>
          </button>
          {open === "sort" && (
            <div style={panel}>
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    setSort(s.key);
                    setOpen(null);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "9px 11px",
                    borderRadius: 9,
                    cursor: "pointer",
                    border: "none",
                    textAlign: "left",
                    background: sort === s.key ? "#EEF0FE" : "transparent",
                    color: sort === s.key ? "#4E5BDC" : "#3A4358",
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Click-away layer for popovers */}
      {open && <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />}

      {/* Active filter chips */}
      {hasFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {cat !== "All" && (
            <FilterChip label={`${CAT_ICONS[cat]} ${cat}`} onClear={() => setCat("All")} />
          )}
          {[...picked].map((b) => (
            <FilterChip key={b} label={b} onClear={() => toggleBrand(b)} />
          ))}
          {q.trim() && <FilterChip label={`“${q.trim()}”`} onClear={() => setQ("")} />}
          {sort !== "featured" && (
            <FilterChip label={SORTS.find((s) => s.key === sort)!.label} onClear={() => setSort("featured")} />
          )}
          <button
            onClick={clearAll}
            style={{ fontSize: 12.5, fontWeight: 600, color: "#4E5BDC", background: "none", border: "none", cursor: "pointer", padding: "6px 4px" }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div
          style={{
            border: "1px dashed #D5DAE4",
            borderRadius: 16,
            padding: "56px 24px",
            textAlign: "center",
            color: "#8A93A6",
          }}
        >
          <div style={{ fontSize: 26, marginBottom: 10 }}>⌕</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#3A4358" }}>No products match</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Try a different search or clear the filters.</div>
          <button
            onClick={clearAll}
            style={{ marginTop: 16, fontSize: 13, fontWeight: 700, color: "#fff", background: "#4E5BDC", border: "none", borderRadius: 10, padding: "10px 20px", cursor: "pointer" }}
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 16 }}>
          {filtered.map((p) => (
            <ProductCard key={p.id} p={p} siblings={variantGroups[familyKey(p)]} />
          ))}
        </div>
      )}
    </main>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 12.5,
        fontWeight: 600,
        color: "#3A4358",
        background: "#fff",
        border: "1px solid #E8EBF1",
        borderRadius: 999,
        padding: "6px 8px 6px 13px",
      }}
    >
      {label}
      <button
        onClick={onClear}
        aria-label={`Remove ${label}`}
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "#EEF0F4",
          color: "#56627A",
          fontSize: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ✕
      </button>
    </span>
  );
}
