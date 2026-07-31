"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import type { Product } from "@/lib/data";
import ProductCard from "./ProductCard";

/**
 * Brand / category hub layout. Clicking "Havells" or "Fans" in a menu lands
 * here rather than on a filtered grid:
 *
 *   • top: up to three horizontal rails (Trending / Top rated / Best sellers)
 *     scoped to the brand or category, OOS excluded, NO trophy badges - the
 *     rail's own #N position is the only rank shown, so the card never
 *     carries two competing numbers;
 *   • below: the scope's ENTIRE catalogue, with the filter rail frozen on the
 *     left and a floating (sticky) sort header on the right column.
 *
 * Facet filtering is client-side and never re-ranks - order stays whatever
 * the server computed for the chosen sort.
 */
type Rail = { key: string; label: string; blurb: string; items: Product[] };
export type StripItem = { label: string; href: string; img?: string | null; emoji?: string };
type Sort = "featured" | "price-asc" | "price-desc" | "save-desc" | "top-sellers" | "new";

export default function HubBrowser({ title, subtitle, rails, products, facetLabel, facets, strip, stripTitle }:
  { title: string; subtitle: string; rails: Rail[]; products: Product[]; facetLabel: string; facets: string[]; strip?: StripItem[]; stripTitle?: string }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // "?facet=Fans" arriving from a Shop-by-brand / Shop-by-category circle
  // preseeds the filter, so brand+category act as one combined filter.
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("facet");
    if (f && facets.includes(f)) setPicked(new Set([f]));
  }, [facets]);
  const [sort, setSort] = useState<Sort>("featured");

  const toggle = (f: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f); else n.add(f);
      return n;
    });

  const facetOf = (p: Product) => (facetLabel === "Brand" ? p.brand : p.cat);

  const shownRails = useMemo(() => {
    const scoped = picked.size === 0 ? rails : rails.map((r) => ({ ...r, items: r.items.filter((p) => picked.has(facetOf(p))) }));
    return scoped.filter((r) => r.items.length >= 3);
  }, [rails, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let l = picked.size === 0 ? products : products.filter((p) => picked.has(facetOf(p)));
    // OOS always sinks, whatever the sort.
    const stockRank = (a: Product, b: Product) => Number(a.inStock === false) - Number(b.inStock === false);
    switch (sort) {
      case "price-asc": l = [...l].sort((a, b) => stockRank(a, b) || a.price - b.price); break;
      case "price-desc": l = [...l].sort((a, b) => stockRank(a, b) || b.price - a.price); break;
      case "save-desc": l = [...l].sort((a, b) => stockRank(a, b) || (1 - b.price / b.market) - (1 - a.price / a.market)); break;
      case "top-sellers": l = [...l].sort((a, b) => stockRank(a, b) || (b.unitsSold ?? 0) - (a.unitsSold ?? 0)); break;
      case "new": l = [...l].sort((a, b) => stockRank(a, b) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "")); break;
      default: break; // featured = server trending order (already OOS-sunk)
    }
    return l;
  }, [products, picked, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchor = (k: string) => `hub-${k}`;

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: 0, maxWidth: 720 }}>{subtitle}</p>
      </header>

      {strip && strip.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{stripTitle}</div>
          <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 8 }}>
            {strip.map((it) => (
              <Link key={it.label} href={it.href} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 74 }}>
                <span style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff", border: "1px solid #E4E7EF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 1px 4px rgba(22,29,43,0.06)" }}>
                  {it.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.img} alt={it.label} width={34} height={34} style={{ objectFit: "contain" }} />
                  ) : it.emoji ? (
                    <span style={{ fontSize: 24 }}>{it.emoji}</span>
                  ) : (
                    <span style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 700, color: "#4E5BDC" }}>{it.label.slice(0, 1)}</span>
                  )}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#3A4358", textAlign: "center", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 74 }}>{it.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="col-shell" style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 26, alignItems: "start" }}>
        {/* ── Frozen filter rail ── */}
        <aside className="col-rail" style={{ position: "sticky", top: 86, maxHeight: "calc(100vh - 110px)", overflowY: "auto", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 16px 18px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>On this page</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
            {shownRails.map((r) => (
              <a key={r.key} href={`#${anchor(r.key)}`} style={{ fontSize: 13, color: "#3A4358", padding: "5px 8px", borderRadius: 7, fontWeight: 600 }}>{r.label}</a>
            ))}
            <a href={`#${anchor("all")}`} style={{ fontSize: 13, color: "#3A4358", padding: "5px 8px", borderRadius: 7, fontWeight: 600 }}>All products ({list.length})</a>
          </nav>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{facetLabel}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {facets.map((f) => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358", cursor: "pointer" }}>
                <input type="checkbox" checked={picked.has(f)} onChange={() => toggle(f)} style={{ accentColor: "#4E5BDC" }} />
                {f}
              </label>
            ))}
          </div>
          {picked.size > 0 && (
            <button onClick={() => setPicked(new Set())} style={{ marginTop: 12, border: "none", background: "none", color: "#4E5BDC", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              Clear filters
            </button>
          )}
        </aside>

        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 26 }}>
          {/* ── The three rails (no trophy badges here) ── */}
          {shownRails.map((r) => (
            <section key={r.key} id={anchor(r.key)} style={{ scrollMarginTop: 90 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontFamily: GROTESK, fontSize: 18.5, fontWeight: 700, margin: 0 }}>{r.label}</h2>
                <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{r.blurb}</span>
              </div>
              <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollSnapType: "x proximity" }}>
                {r.items.map((p, i) => (
                  <div key={p.id} style={{ flex: "0 0 216px", scrollSnapAlign: "start", position: "relative" }}>
                    <div style={{ position: "absolute", top: -1, left: 8, zIndex: 2, background: i === 0 ? "#B8860B" : "#161D2B", color: "#fff", fontFamily: "var(--space-mono)", fontSize: 11, fontWeight: 700, borderRadius: "0 0 7px 7px", padding: "3px 8px" }}>
                      #{i + 1}
                    </div>
                    <ProductCard p={p} fixedWidth={216} />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* ── Full scope catalogue with floating sort header ── */}
          <section id={anchor("all")} style={{ scrollMarginTop: 90 }}>
            <div style={{ position: "sticky", top: 78, zIndex: 5, background: "#F7F8FB", padding: "8px 0 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #E8EBF1", marginBottom: 14 }}>
              <h2 style={{ fontFamily: GROTESK, fontSize: 18.5, fontWeight: 700, margin: 0 }}>All products</h2>
              <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{list.length} item{list.length === 1 ? "" : "s"}</span>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#56627A", fontWeight: 600 }}>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                  style={{ border: "1px solid #E0E4ED", borderRadius: 9, padding: "7px 10px", fontSize: 13, background: "#fff", cursor: "pointer" }}>
                  <option value="featured">Featured</option>
                  <option value="top-sellers">Best selling</option>
                  <option value="save-desc">Biggest saving</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="new">Newest</option>
                </select>
              </label>
            </div>
            {/* Keyed on the filter state: filter changes fade-bounce the grid
                back in; nothing else on the page re-renders. */}
            <div
              key={`${[...picked].sort().join("+")}|${sort}`}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))", gap: 14 }}
            >
              {list.map((p, i) => (
                <div key={p.id} className="pgrid-in" style={{ "--gi": Math.min(i, 20) } as React.CSSProperties}>
                  <ProductCard p={p} />
                </div>
              ))}
            </div>
            {list.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
                Nothing matches those filters.
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .col-shell { grid-template-columns: 1fr !important; }
          /* Phones get no filter rail at all - the brand/category strip and
             the rails ARE the navigation there. */
          .col-rail { display: none !important; }
        }
      `}</style>
    </main>
  );
}
