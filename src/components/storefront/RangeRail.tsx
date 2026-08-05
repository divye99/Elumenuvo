"use client";

import { useEffect, useRef, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import PdpCollapse from "@/components/storefront/PdpCollapse";
import { dimsOf } from "@/lib/variants";
import type { Product } from "@/lib/data";

/**
 * The full variant family as a horizontal card rail, the way a marketplace
 * shows "other options": photo, name, what makes this one different, price.
 *
 * It replaced a 6-to-10-column table. A table made a buyer read a spec sheet
 * to answer "which colour is this", when the answer is a picture; and on a
 * phone it scrolled sideways with no photo at all.
 *
 * The card is the same ProductCard used on the catalogue grid, so pricing,
 * GST handling, discount badges and stock states stay defined in one place.
 * `siblings` is deliberately NOT passed: the in-card swatch swapper would let
 * a card silently become a different variant than its neighbour, inside a rail
 * whose whole purpose is one card per variant.
 */
const CARD_W = 208;
const FIRST_PAGE = 16;

export default function RangeRail({ p, family }: { p: Product; family: Product[] }) {
  const [showAll, setShowAll] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);

  // The dimensions that actually vary across this family (Colour, Length,
  // Size...). One shared list, so every card describes itself the same way.
  const dims = dimsOf(family);
  const shown = showAll ? family : family.slice(0, FIRST_PAGE);

  // Bring the variant being viewed into the rail by scrolling the RAIL only.
  // scrollIntoView (even with block: "nearest") scrolls ancestors too, which
  // yanked the whole page down to this section after every variant switch.
  // Centering runs once the rail has real layout, so it also works when the
  // mobile collapse opens later (collapsed = display:none = zero width).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let done = false;
    const centre = () => {
      const el = currentRef.current;
      if (done || !el || rail.clientWidth === 0) return;
      done = true;
      const railRect = rail.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const left = rail.scrollLeft + (elRect.left - railRect.left) - (rail.clientWidth - elRect.width) / 2;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      rail.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
    };
    centre();
    if (done) return;
    const ro = new ResizeObserver(centre);
    ro.observe(rail);
    return () => ro.disconnect();
  }, []);

  const lineFor = (s: Product) => {
    const parts = dims.map((d) => s.attrs?.[d]).filter(Boolean) as string[];
    return parts.length ? parts.join(" · ") : undefined;
  };

  return (
    <PdpCollapse title="The full range" sec="range" count={`${family.length} options`}>
      <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 14 }}>
        Every option is its own product with live pricing. Scroll across and tap to switch.
      </div>

      <div
        ref={railRef}
        style={{
          display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10,
          // `proximity`, never `mandatory`: mandatory snapping fights a
          // customer trying to flick past several cards at once.
          scrollSnapType: "x proximity",
          scrollbarWidth: "thin",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {shown.map((s) => {
          const isCurrent = s.id === p.id;
          return (
            <div key={s.id} ref={isCurrent ? currentRef : undefined} style={{ scrollSnapAlign: "start", flex: "0 0 auto" }}>
              <ProductCard p={s} fixedWidth={CARD_W} current={isCurrent} attrsLine={lineFor(s)} />
            </div>
          );
        })}
      </div>

      {!showAll && family.length > FIRST_PAGE && (
        <button
          onClick={() => setShowAll(true)}
          style={{ marginTop: 12, background: "none", border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#4E5BDC", cursor: "pointer" }}
        >
          Show all {family.length} options
        </button>
      )}
    </PdpCollapse>
  );
}
