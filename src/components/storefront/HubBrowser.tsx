"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import CategoryIcon from "@/components/storefront/CategoryIcon";
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
export type StripItem = { label: string; href: string; img?: string | null; emoji?: string; cat?: string };
type Sort = "featured" | "price-asc" | "price-desc" | "save-desc" | "top-sellers" | "new";

export type FacetTreeGroup = { group: string; subs: { value: string; label: string }[] };

export default function HubBrowser({ title, subtitle, hideHeader, rails, products, facetLabel, facets, strip, stripTitle, facet2Label, facets2, facet2Of, facetTreeLabel, facetTree, facetTreeOf }:
  { title: string; subtitle: string;
    /** Skip the h1+subtitle header (a brand-experience hero above already
     *  introduces the page and carries the h1). */
    hideHeader?: boolean;
    rails: Rail[]; products: Product[]; facetLabel: string; facets: string[]; strip?: StripItem[]; stripTitle?: string;
    /** Optional second filter dimension (e.g. Norisys "Series"): values +
     *  a product-id -> value map, rendered as a second checklist. */
    facet2Label?: string; facets2?: string[]; facet2Of?: Record<string, string>;
    /** Optional two-level filter dimension (e.g. Norisys "Finish"): compact
     *  top-level groups; ticking a group reveals its tone checkboxes. */
    facetTreeLabel?: string; facetTree?: FacetTreeGroup[]; facetTreeOf?: Record<string, string> }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [picked2, setPicked2] = useState<Set<string>>(new Set());
  const [pickedG, setPickedG] = useState<Set<string>>(new Set()); // tree groups
  const [pickedS, setPickedS] = useState<Set<string>>(new Set()); // tree sub values

  // Lookup maps for the tree facet: full value -> group, group -> its values.
  const treeMaps = useMemo(() => {
    const valueGroup: Record<string, string> = {};
    const groupValues: Record<string, string[]> = {};
    for (const g of facetTree ?? []) {
      groupValues[g.group] = g.subs.map((s) => s.value);
      for (const s of g.subs) valueGroup[s.value] = g.group;
      if (g.subs.length === 0) { valueGroup[g.group] = g.group; groupValues[g.group] = [g.group]; }
    }
    return { valueGroup, groupValues };
  }, [facetTree]);

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
  const passesTree = (p: Product) => {
    if (pickedG.size === 0) return true;
    const v = facetTreeOf?.[p.id];
    const g = v ? treeMaps.valueGroup[v] : undefined;
    if (!v || !g || !pickedG.has(g)) return false;
    // Tones narrow within their group; a group with no ticked tone takes all.
    const groupHasPickedSub = (treeMaps.groupValues[g] ?? []).some((x) => pickedS.has(x));
    return groupHasPickedSub ? pickedS.has(v) : true;
  };
  const passes = (p: Product) =>
    (picked.size === 0 || picked.has(facetOf(p))) &&
    (picked2.size === 0 || picked2.has(facet2Of?.[p.id] ?? "")) &&
    passesTree(p);

  const noFilters = picked.size === 0 && picked2.size === 0 && pickedG.size === 0;
  const shownRails = useMemo(() => {
    const scoped = noFilters ? rails : rails.map((r) => ({ ...r, items: r.items.filter(passes) }));
    return scoped.filter((r) => r.items.length >= 3);
  }, [rails, picked, picked2, pickedG, pickedS]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => {
    let l = products.filter(passes);
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
  }, [products, picked, picked2, pickedG, pickedS, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const anchor = (k: string) => `hub-${k}`;

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
      {!hideHeader && (
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "0 0 6px" }}>{title}</h1>
          <p style={{ fontSize: 14, color: "#56627A", margin: 0, maxWidth: 720 }}>{subtitle}</p>
        </header>
      )}

      {strip && strip.length > 0 && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>{stripTitle}</div>
          <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 8 }}>
            {strip.map((it) => (
              <Link key={it.label} href={it.href} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 74 }}>
                <span style={{ width: 58, height: 58, borderRadius: 8, background: "#fff", border: "1px solid #E4E7EF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {it.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.img} alt={it.label} width={34} height={34} style={{ objectFit: "contain" }} />
                  ) : it.cat ? (
                    <span style={{ color: "#3A4358", display: "inline-flex" }}><CategoryIcon cat={it.cat} size={26} strokeWidth={1.5} /></span>
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
        <aside className="col-rail" style={{ position: "sticky", top: 86, maxHeight: "calc(100vh - 110px)", overflowY: "auto", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "16px 16px 18px" }}>
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
          {facet2Label && facets2 && facets2.length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", margin: "16px 0 8px" }}>{facet2Label}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {facets2.map((f) => (
                  <label key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358", cursor: "pointer" }}>
                    <input type="checkbox" checked={picked2.has(f)} onChange={() => setPicked2((prev) => { const n = new Set(prev); if (n.has(f)) n.delete(f); else n.add(f); return n; })} style={{ accentColor: "#4E5BDC" }} />
                    {f}
                  </label>
                ))}
              </div>
            </>
          )}
          {facetTreeLabel && facetTree && facetTree.length > 0 && (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", margin: "16px 0 8px" }}>{facetTreeLabel}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {facetTree.map((g) => (
                  <div key={g.group}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358", cursor: "pointer" }}>
                      <input type="checkbox" checked={pickedG.has(g.group)} onChange={() => {
                        setPickedG((prev) => {
                          const n = new Set(prev);
                          if (n.has(g.group)) {
                            n.delete(g.group);
                            // Unticking a group also drops its tone picks.
                            setPickedS((ps) => { const m = new Set(ps); for (const s of g.subs) m.delete(s.value); return m; });
                          } else n.add(g.group);
                          return n;
                        });
                      }} style={{ accentColor: "#4E5BDC" }} />
                      {g.group}
                    </label>
                    {pickedG.has(g.group) && g.subs.length > 1 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, margin: "4px 0 4px 24px" }}>
                        {g.subs.map((s) => (
                          <label key={s.value} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#56627A", cursor: "pointer" }}>
                            <input type="checkbox" checked={pickedS.has(s.value)} onChange={() => setPickedS((prev) => { const n = new Set(prev); if (n.has(s.value)) n.delete(s.value); else n.add(s.value); return n; })} style={{ accentColor: "#4E5BDC" }} />
                            {s.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          {!noFilters && (
            <button onClick={() => { setPicked(new Set()); setPicked2(new Set()); setPickedG(new Set()); setPickedS(new Set()); }} style={{ marginTop: 12, border: "none", background: "none", color: "#4E5BDC", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
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
                  <div key={p.id} className="prail-card" style={{ flex: "0 0 216px", scrollSnapAlign: "start", position: "relative", display: "flex" }}>
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
            {/* Plain (non-sticky) section header: a bar frozen mid-scroll read
                as broken (owner, Aug 2026); the rail already floats the tools. */}
            <div style={{ padding: "8px 0 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #E8EBF1", marginBottom: 14 }}>
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
              key={`${[...picked, ...picked2, ...pickedG, ...pickedS].sort().join("+")}|${sort}`}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))", gap: 14 }}
            >
              {list.map((p, i) => (
                <div key={p.id} className="pgrid-in" style={{ "--gi": Math.min(i, 20), display: "flex" } as React.CSSProperties}>
                  <ProductCard p={p} />
                </div>
              ))}
            </div>
            {list.length === 0 && (
              <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
                Nothing matches those filters.
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        /* Equal-height cards: the wrapper is a flex box, so the card anchor
           stretches to the tallest sibling in its rail row / grid row. */
        .prail-card > a, .pgrid-in > a { flex: 1 1 auto; min-width: 0; }
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
