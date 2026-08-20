"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import type { Product } from "@/lib/data";
import ProductCard from "./ProductCard";
import { slugify } from "@/lib/slug";

/**
 * Collection layout: a frozen filter rail on the left, one horizontal top-10
 * rail per category on the right. The rail sticks (position: sticky) so the
 * filters and category jump-list stay in reach however far the page scrolls.
 * Brand filtering happens client-side against the already-ranked rails - it
 * narrows what is shown but never re-ranks, so order stays server-truth.
 */
type Rail = { cat: string; items: Product[] };

const CAT_ICON: Record<string, string> = {
  "Wires & Cables": "🔌", Switchgear: "⚡", Modular: "🎛️", Fans: "🌀",
  "DB & Panels": "🗄️", Lighting: "💡", Pumps: "🚰", "Electrical Accessories": "🔧", "EV Charging": "🔋",
};

export default function CollectionBrowser({ kind, title, blurb, rails, brands }:
  { kind: string; title: string; blurb: string; rails: Rail[]; brands: string[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (b: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(b)) n.delete(b); else n.add(b);
      return n;
    });

  const shown = useMemo(() => {
    if (picked.size === 0) return rails;
    return rails
      .map((r) => ({ ...r, items: r.items.filter((p) => picked.has(p.brand)) }))
      .filter((r) => r.items.length > 0);
  }, [rails, picked]);

  const anchor = (cat: string) => `cat-${cat.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "0 0 6px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: 0, maxWidth: 720 }}>{blurb}</p>
      </header>

      <div className="col-shell" style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 26, alignItems: "start" }}>
        {/* ── Frozen filter rail ── */}
        <aside className="col-rail" style={{ position: "sticky", top: 86, maxHeight: "calc(100vh - 110px)", overflowY: "auto", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "16px 16px 18px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Jump to category</div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 16 }}>
            {shown.map((r) => (
              <a key={r.cat} href={`#${anchor(r.cat)}`} style={{ fontSize: 13, color: "#3A4358", padding: "5px 8px", borderRadius: 7, fontWeight: 600 }}>
                {CAT_ICON[r.cat] ?? "•"} {r.cat} <span style={{ color: "#A0A7B5", fontWeight: 400 }}>({r.items.length})</span>
              </a>
            ))}
          </nav>

          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Brand</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {brands.map((b) => (
              <label key={b} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358", cursor: "pointer", padding: "2px 2px" }}>
                <input type="checkbox" checked={picked.has(b)} onChange={() => toggle(b)} style={{ accentColor: "#1D2F8A" }} />
                {b}
              </label>
            ))}
          </div>
          {picked.size > 0 && (
            <button onClick={() => setPicked(new Set())} style={{ marginTop: 12, border: "none", background: "none", color: "#1D2F8A", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
              Clear brands
            </button>
          )}
        </aside>

        {/* ── Category rails ── */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 26 }}>
          {shown.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
              No products match those brands here yet.
            </div>
          )}
          {shown.map((r) => (
            <section key={r.cat} id={anchor(r.cat)} style={{ scrollMarginTop: 90 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontFamily: GROTESK, fontSize: 18.5, fontWeight: 700, margin: 0 }}>{CAT_ICON[r.cat] ?? ""} {r.cat}</h2>
                <span style={{ fontSize: 12.5, color: "#8A93A6" }}>top {r.items.length}</span>
                <Link href={`/category/${slugify(r.cat)}`} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#1D2F8A", whiteSpace: "nowrap" }}>
                  All {r.cat.toLowerCase()} →
                </Link>
              </div>
              {/* Horizontal rail: scrolls sideways inside its own box. Keyed on
                  the brand filter so a filter change fade-bounces the rail in. */}
              <div key={[...picked].sort().join("+")} style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollSnapType: "x proximity" }}>
                {r.items.map((p, i) => (
                  <div key={p.id} className="pgrid-in" style={{ flex: "0 0 216px", scrollSnapAlign: "start", position: "relative", "--gi": Math.min(i, 20) } as React.CSSProperties}>
                    <div style={{ position: "absolute", top: -1, left: 8, zIndex: 2, background: i === 0 ? "#B8860B" : "#16215B", color: "#fff", fontFamily: "var(--space-mono)", fontSize: 11, fontWeight: 700, borderRadius: "0 0 7px 7px", padding: "3px 8px" }}>
                      #{i + 1}
                    </div>
                    {/* No trophy badge here on purpose: the rail's #N position is the only
                        rank a card shows, so two numbers never compete. Trophies stay on
                        the homepage and the full catalogue. */}
                    <ProductCard p={p} fixedWidth={216} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Mobile: rail becomes a top block (sticky sidebars don't fit) */}
      <style>{`
        @media (max-width: 860px) {
          .col-shell { grid-template-columns: 1fr !important; }
          .col-rail { display: none !important; } /* no filter rail on phones */
        }
      `}</style>
    </main>
  );
}
