"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import { GROTESK } from "@/lib/fonts";
import { CATS, type Product } from "@/lib/data";
import { groupVariants, familyKey } from "@/lib/variants";
import { logSearch } from "@/lib/search-log";
import { useSearchParams } from "next/navigation";
import { editDistance, normalizeSearchText } from "@/lib/search-normalize";
import { rankSearch } from "@/lib/search-rank";
import CategoryIcon from "@/components/storefront/CategoryIcon";

// Category icons come from the shared Elume icon system (CategoryIcon);
// "All" gets no icon - text carries it.

type Sort = "featured" | "recommended" | "top-sellers" | "top-rated" | "price-asc" | "price-desc" | "save-desc" | "new";
const SORTS: { key: Sort; label: string }[] = [
  { key: "featured", label: "Featured" },
  { key: "recommended", label: "Recommended" },
  { key: "top-sellers", label: "Top sellers" },
  { key: "top-rated", label: "Top rated" },
  { key: "new", label: "New releases" },
  { key: "save-desc", label: "Biggest savings" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];
const isSort = (s: string): s is Sort => SORTS.some((x) => x.key === s);

/** Public catalogue browser - one sticky command bar (search · category pills ·
 *  brand + sort popovers) over the product grid. Initial search/category arrive
 *  via URL params so the home page can deep-link. */
export default function CatalogueBrowser({
  products,
  initialQ = "",
  initialCat = "All",
  initialSort = "featured",
  editorial = {},
  searchBoost = {},
  glanceBoost = {},
  personalShelf,
}: {
  products: Product[];
  initialQ?: string;
  initialCat?: string;
  initialSort?: string;
  editorial?: Record<string, { bestFor: string; rank: number; slug: string; postTitle: string }>;
  /** productId -> times chosen from search; learned signal reshaping Featured. */
  searchBoost?: Record<string, number>;
  /** productId -> 30-day glance views; ties between equally-specced brands
   *  go to what buyers actually look at and buy. */
  glanceBoost?: Record<string, number>;
  personalShelf?: React.ReactNode;
}) {
  // URL params are read client-side (the page itself is static/cached).
  const sp = useSearchParams();
  const urlQ = sp.get("q") ?? initialQ;
  const urlCat = sp.get("cat") ?? initialCat;
  const urlSort = sp.get("sort") ?? initialSort;
  const [cat, setCat] = useState(CATS.includes(urlCat) ? urlCat : "All");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(urlQ);
  const [sort, setSort] = useState<Sort>(isSort(urlSort) ? urlSort : "featured");
  // Header search while already on the catalogue: only the URL changes, so
  // sync the filters when params move.
  useEffect(() => {
    setQ(sp.get("q") ?? "");
    const c = sp.get("cat");
    if (c !== null || sp.get("q") !== null) setCat(c && CATS.includes(c) ? c : "All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);
  const [sheet, setSheet] = useState(false); // mobile filter bottom-sheet
  const [brandQuery, setBrandQuery] = useState(""); // sidebar brand finder

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products]
  );

  const variantGroups = useMemo(() => groupVariants(products), [products]);

  // Stage-1 search logging: record a SETTLED search (1.2s after the last
  // keystroke) with its result count, once per distinct query per visit.
  // Zero-result rows become the "demand we do not carry" report.
  const loggedRef = useRef<Set<string>>(new Set());

  // Render the grid in pages of 60; mounting thousands of cards at once is
  // what made searches feel slow. Cap resets whenever the filters change.
  const PAGE = 60;
  const [shown, setShown] = useState(PAGE);

  // Typing stays instant: React renders the keystroke first and re-filters
  // the 3,300-row grid at deferred priority.
  const dq = useDeferredValue(q);
  useEffect(() => { setShown(PAGE); }, [dq, cat, picked, sort]);

  const { filtered, correctedTo, relaxedNote, brandCount, catCount } = useMemo(() => {
    const facetCounts = (matched: Product[]) => {
      // Facet counts describe THIS result set, not the whole catalogue -
      // a brand that would give zero results for the query never advertises
      // a count it cannot deliver. Each facet ignores its own selection
      // (standard faceting), so counts read as "what happens if I pick this".
      const brandCount: Record<string, number> = {};
      const catCount: Record<string, number> = { All: 0 };
      for (const p of matched) {
        if (cat === "All" || p.cat === cat) brandCount[p.brand] = (brandCount[p.brand] ?? 0) + 1;
        if (picked.size === 0 || picked.has(p.brand)) {
          catCount[p.cat] = (catCount[p.cat] ?? 0) + 1;
          catCount.All += 1;
        }
      }
      return { brandCount, catCount };
    };

    // Exact-code short-circuit (ASIN behaviour): a query that IS an ELIN,
    // our SKU or a manufacturer SKU returns exactly that product, ahead of
    // any word matching. Whitespace-insensitive so "r-fs 001" hits "R-FS 001".
    const codeQ = dq.replace(/\s+/g, "").toUpperCase();
    if (codeQ.length >= 4) {
      const exact = products.filter((p) =>
        [p.elin, p.sku, p.brandSku].some((v) => v && v.replace(/\s+/g, "").toUpperCase() === codeQ)
      );
      if (exact.length > 0) {
        return { filtered: exact, correctedTo: null, relaxedNote: null, ...facetCounts(exact) };
      }
    }

    const hasQuery = dq.trim().length > 0;
    // The lexicon-aware ranker (search-rank.ts) owns matching over the FULL
    // catalogue: it speaks the buyer's language (glued units, DP/FP
    // shorthand, plurals, colour words, typos) and NEVER returns an empty
    // page while anything partially matches - it relaxes and says so.
    // Category/brand gates apply AFTER ranking so facet counts stay honest.
    const outcome = hasQuery ? rankSearch(dq, products) : null;
    const matched = outcome ? outcome.results.map((r) => r.item) : products;
    const list = matched.filter(
      (p) => (cat === "All" || p.cat === cat) && (picked.size === 0 || picked.has(p.brand))
    );
    const rel = new Map<string, number>(outcome ? outcome.results.map((r) => [r.item.id, r.score]) : []);
    const tokensActive = hasQuery;
    const correctedTo =
      outcome && outcome.corrections.length
        ? outcome.corrections.map(([from, to]) => `${from} → ${to}`).join(", ")
        : null;
    const relaxedNote = outcome?.relaxed?.note ?? null;
    // Out-of-stock products stay browsable and searchable, but never lead a
    // list: sink them to the bottom of whatever ordering is chosen.
    const stockRank = (a: Product, b: Product) => Number(a.inStock === false) - Number(b.inStock === false);
    const sorted = (() => {
    switch (sort) {
      case "recommended":
        return [...list].sort((a, b) => stockRank(a, b) || Number(b.recommended ?? false) - Number(a.recommended ?? false));
      case "top-sellers":
        return [...list].sort((a, b) => stockRank(a, b) || (b.unitsSold ?? 0) - (a.unitsSold ?? 0));
      case "top-rated":
        return [...list].sort(
          (a, b) => stockRank(a, b) || (b.rating ?? 0) - (a.rating ?? 0) || (b.ratingCount ?? 0) - (a.ratingCount ?? 0)
        );
      case "price-asc":
        return [...list].sort((a, b) => stockRank(a, b) || a.price - b.price);
      case "price-desc":
        return [...list].sort((a, b) => stockRank(a, b) || b.price - a.price);
      case "save-desc":
        return [...list].sort((a, b) => stockRank(a, b) || (1 - b.price / b.market) - (1 - a.price / a.market));
      case "new":
        // Catalogue rows are appended over time, so reverse featured order ≈ newest first.
        return [...list].reverse();
      default: {
        // Featured = TRENDING (sales + search picks + recommendation), and the
        // landing view opens with a diverse shelf: the first 20 products are
        // all different brands, cycling through categories, so no single
        // brand (like our own) walls off the top of the catalogue.
        // Photo rule from the visibility ranking system: a listing without an
        // image runs at a fifth of its trend, so it cannot occupy the landing
        // shelf while imaged competitors exist.
        const trend = (p: Product) =>
          (p.image ? 1 : 0.2) *
          // eslint-disable-next-line no-mixed-operators
          // Elume house-brand dial (owner call, Aug 2026): visible but not
          // pushed - halve its trend on featured surfaces until the brand
          // earns organic pull. Search, compare and PDPs are untouched.
          (p.brand === "Elume" ? 0.5 : 1) *
          (Math.min(searchBoost[p.id] ?? 0, 20) * 3 +
            Math.min(p.unitsSold ?? 0, 200) +
            (p.recommended ? 8 : 0) +
            // Glance views: what buyers actually look at, 30-day window.
            Math.min(glanceBoost[p.id] ?? 0, 400) * 0.25 +
            // Reviews: a well-rated product with real reviews outranks an
            // unreviewed twin; a poorly-rated one sinks.
            ((p.rating ?? 0) >= 4 ? Math.min(p.ratingCount ?? 0, 25) * 4 : 0) -
            ((p.rating ?? 0) > 0 && (p.rating ?? 0) < 3 ? 30 : 0));
        // With a query active, RELEVANCE (the ranker's score) leads and trend
        // only breaks ties: "havells wire" must show wires before Wi-Fi
        // sockets whose specs merely mention "wireless".
        const ranked = [...list].sort(
          (a, b) => stockRank(a, b) || (rel.get(b.id) ?? 0) - (rel.get(a.id) ?? 0) || trend(b) - trend(a)
        );
        const filtersActive = cat !== "All" || picked.size > 0 || tokensActive;
        if (filtersActive) return ranked;

        const lead: Product[] = [];
        const chosen = new Set<string>();
        const usedBrand = new Set<string>();
        let usedCat = new Set<string>();
        while (lead.length < 20) {
          let pick = ranked.find((p) => !chosen.has(p.id) && !usedBrand.has(p.brand) && !usedCat.has(p.cat));
          if (!pick && usedCat.size) { usedCat = new Set(); continue; }   // category cycle restarts
          if (!pick) pick = ranked.find((p) => !chosen.has(p.id));        // brands exhausted → best remaining
          if (!pick) break;
          lead.push(pick); chosen.add(pick.id); usedBrand.add(pick.brand); usedCat.add(pick.cat);
        }
        return [...lead, ...ranked.filter((p) => !chosen.has(p.id))];
      }
    }
    })();
    return { filtered: sorted, correctedTo, relaxedNote, ...facetCounts(matched) };
  }, [products, cat, picked, dq, sort, searchBoost, glanceBoost]);

  useEffect(() => {
    const needle = q.trim();
    if (needle.length < 2) return;
    const t = setTimeout(() => {
      const key = `${needle.toLowerCase()}|${cat}`;
      if (loggedRef.current.has(key)) return;
      loggedRef.current.add(key);
      // A relaxed (best-effort) page is NOT an exact hit: log 0 so the
      // missed-demand report keeps seeing what we genuinely don't carry.
      logSearch({ q: needle, source: "search", results: relaxedNote ? 0 : filtered.length, cat: cat === "All" ? undefined : cat });
    }, 1200);
    return () => clearTimeout(t);
  }, [q, cat, filtered.length, relaxedNote]);

  // When even the partial fallback finds nothing (SKU-style queries like
  // "CHZ/PO/0015"), read category INTENT from the words instead: fuzzy-match
  // tokens against category names and offer that category's most popular
  // products, so the dead end still hands the shopper somewhere to go.
  const deadEndSuggest = useMemo(() => {
    if (filtered.length !== 0) return null;
    // Letter runs, not whitespace tokens: "CHZ/PO/0015" still yields "chz",
    // "po" so even part-number pastes reach the fallback shelf.
    const toks = normalizeSearchText(dq).split(/[^\p{L}]+/u).filter((t) => t.length >= 3);
    if (dq.trim().length < 2) return null;
    const cats = [...new Set(products.map((p) => p.cat))];
    const hitCats = cats.filter((c) =>
      normalizeSearchText(c).split(/\s+/).some((w) =>
        toks.some((t) => w.startsWith(t) || t.startsWith(w) || editDistance(t, w, 2) <= (w.length <= 5 ? 1 : 2))
      )
    );
    const pool = (hitCats.length ? products.filter((p) => hitCats.includes(p.cat)) : products)
      .filter((p) => p.inStock !== false && p.image);
    const trendLite = (p: Product) => Math.min(searchBoost[p.id] ?? 0, 20) * 3 + Math.min(p.unitsSold ?? 0, 200) + (p.recommended ? 8 : 0);
    const items = [...pool].sort((a, b) => trendLite(b) - trendLite(a)).slice(0, 8);
    return items.length ? { cats: hitCats, items } : null;
  }, [filtered.length, dq, products, searchBoost]);

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

  const sideCard: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "12px 12px 13px", display: "flex", flexDirection: "column", gap: 8 };
  const sideLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6" };
  const sideSelect: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#19202E", padding: "9px 10px", borderRadius: 10, border: "1px solid #E0E4ED", background: "#F8F9FC", width: "100%", cursor: "pointer" };

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 28px 56px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 16 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 32, fontWeight: 600, letterSpacing: "-0.8px", margin: 0 }}>
          The FMEG catalogue
        </h1>
      </div>

      {personalShelf}

      {/* ── Mobile filter pill ── */}
      {/* One search bar everywhere: the header owns the query (Amazon
          pattern). This bar only exists on phones/tablets as the entry to
          the filter sheet; desktop filters live in the left rail below. */}
      <div
        className="cat-cmdbar"
        style={{
          zIndex: 30,
          alignItems: "center",
          gap: 10,
          padding: 8,
          borderRadius: 16,
          background: "rgba(255,255,255,0.82)",
          border: "1px solid #E8EBF1",
          boxShadow: "0 10px 30px rgba(20,24,45,.07)",
          marginBottom: 18,
        }}
      >
        {/* Mobile: single filter icon opening the bottom sheet */}
        <button className="cat-filterbtn" aria-label="Filters" onClick={() => setSheet(true)}>
          <svg width="17" height="15" viewBox="0 0 17 15" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 2.5h15M3.5 7.5h10M6 12.5h5" stroke="#3A4358" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {hasFilters && (
            <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#4E5BDC", color: "#fff", fontSize: 8.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(cat !== "All" ? 1 : 0) + picked.size + (sort !== "featured" ? 1 : 0)}
            </span>
          )}
        </button>

      </div>

      {/* Mobile filter bottom sheet - one list with sort, category and brand */}
      {sheet && (
        <>
          <div className="cat-sheet-overlay" onClick={() => setSheet(false)} />
          <div className="cat-sheet">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: GROTESK, fontWeight: 700, fontSize: 14 }}>Filters</span>
              <button onClick={() => setSheet(false)} aria-label="Close" style={{ background: "none", border: "none", fontSize: 21, color: "#8A93A6", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>

            <div style={sheetH}>Sort by</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SORTS.map((s) => (
                <button key={s.key} onClick={() => setSort(s.key)} style={chip(sort === s.key)}>{s.label}</button>
              ))}
            </div>

            <div style={sheetH}>Category</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATS.map((label) => (
                <button key={label} onClick={() => setCat(label)} style={chip(cat === label)}>
                  {label === "All" ? "All" : label} <span style={{ opacity: 0.6, fontWeight: 500 }}>{catCount[label] ?? 0}</span>
                </button>
              ))}
            </div>

            <div style={sheetH}>Brand</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {brands.map((b) => (
                <button key={b} onClick={() => toggleBrand(b)} style={chip(picked.has(b))}>
                  {b} <span style={{ opacity: 0.6, fontWeight: 500 }}>{brandCount[b]}</span>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {hasFilters && (
                <button onClick={clearAll} style={{ flex: 1, fontSize: 12, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FE", border: "none", borderRadius: 10, padding: "11px 12px", cursor: "pointer" }}>
                  Clear all
                </button>
              )}
              <button onClick={() => setSheet(false)} style={{ flex: 2, fontSize: 12, fontWeight: 700, color: "#fff", background: "#4E5BDC", border: "none", borderRadius: 10, padding: "11px 12px", cursor: "pointer" }}>
                Show {filtered.length} products
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Two-column body: left filter rail (desktop) + results ── */}
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
        <aside className="cat-sidebar">
          <div style={sideCard}>
            <div style={sideLabel}>Sort by</div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={sideSelect}>
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div style={sideCard}>
            <div style={sideLabel}>Category</div>
            <select value={cat} onChange={(e) => setCat(e.target.value)} style={sideSelect}>
              {CATS.filter((label) => label === "All" || label === cat || (catCount[label] ?? 0) > 0).map((label) => (
                <option key={label} value={label}>
                  {label === "All" ? "All categories" : label} ({catCount[label] ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div style={sideCard}>
            <div style={sideLabel}>Brand</div>
            <input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Find a brand…"
              style={{ fontSize: 12.5, padding: "8px 10px", borderRadius: 9, border: "1px solid #E0E4ED", background: "#F8F9FC", outline: "none", width: "100%" }}
            />
            <div style={{ maxHeight: 296, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1 }}>
              {brands
                .filter((b) => (brandCount[b] ?? 0) > 0 || picked.has(b))
                .filter((b) => !brandQuery.trim() || b.toLowerCase().includes(brandQuery.trim().toLowerCase()))
                .map((b) => {
                const on = picked.has(b);
                return (
                  <button
                    key={b}
                    onClick={() => toggleBrand(b)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%", fontSize: 12.5, fontWeight: 600, padding: "7px 8px", borderRadius: 8, cursor: "pointer", border: "none", textAlign: "left", background: on ? "#EEF0FE" : "transparent", color: on ? "#4E5BDC" : "#3A4358" }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 15, height: 15, borderRadius: 5, border: `1.5px solid ${on ? "#4E5BDC" : "#C9CFDB"}`, background: on ? "#4E5BDC" : "#fff", color: "#fff", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on ? "\u2713" : ""}</span>
                      {b}
                    </span>
                    <span style={{ fontSize: 11, color: "#A0A7B5", fontWeight: 500 }}>{brandCount[b]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearAll} style={{ fontSize: 12.5, fontWeight: 700, color: "#4E5BDC", background: "none", border: "1px solid #E0E4ED", borderRadius: 10, cursor: "pointer", padding: "9px 12px" }}>
              Clear all filters
            </button>
          )}
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
      {/* Results header: the navbar owns the query; this line confirms it. */}
      {dq.trim() && (
        <div style={{ fontSize: 14, color: "#3A4358", margin: "0 0 12px" }}>
          <b>{filtered.length.toLocaleString("en-IN")}</b> result{filtered.length === 1 ? "" : "s"} for{" "}
          <b>“{dq.trim()}”</b>
        </div>
      )}

      {/* Active filter chips */}
      {hasFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {cat !== "All" && (
            <FilterChip label={cat} onClear={() => setCat("All")} />
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
      {/* Typo rescue is announced, never silent: the shopper typed one thing
          and is seeing another, and Amazon's wording for this is the pattern
          buyers already know. */}
      {correctedTo && (
        <div style={{ fontSize: 13.5, color: "#3A4358", background: "#F2FBF6", border: "1px solid #DCEDE3", borderRadius: 10, padding: "10px 14px", margin: "0 0 14px" }}>
          Including close spellings: <b>{correctedTo}</b>
        </div>
      )}
      {relaxedNote && (
        <div style={{ fontSize: 13.5, color: "#3A4358", background: "#FFF9EE", border: "1px solid #F0DFC0", borderRadius: 10, padding: "10px 14px", margin: "0 0 14px" }}>
          {relaxedNote}
        </div>
      )}
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
          {deadEndSuggest && (
            <div style={{ marginTop: 34, textAlign: "left" }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#19202E", marginBottom: 12 }}>
                {deadEndSuggest.cats.length
                  ? <>Were you looking for {deadEndSuggest.cats.join(" or ")}? Popular picks:</>
                  : "Popular right now:"}
              </div>
              <div className="cat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 16 }}>
                {deadEndSuggest.items.map((p) => (
                  <ProductCard key={p.id} p={p} siblings={variantGroups[familyKey(p)]} editorial={editorial} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Keyed on the FILTER state (not the search text, so typing never
              strobes): changing a filter remounts only this grid, and the
              cards fade-bounce back in. The rail and page never reload. */}
          <div
            key={`${cat}|${[...picked].sort().join("+")}|${sort}`}
            className="cat-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 16 }}
          >
            {filtered.slice(0, shown).map((p, i) => (
              <div
                key={p.id}
                className="pgrid-in"
                style={{ "--gi": Math.min(i, 20) } as React.CSSProperties}
                onClickCapture={() => {
                  // Self-learning inlet #2: a card clicked on a query page is
                  // a human confirming "this query means this product" - the
                  // same signal as a dropdown pick. Feeds pickTotals (featured
                  // boost), picksByQuery (suggest) and product_aliases (BOQ).
                  const needle = dq.trim();
                  if (needle.length >= 2) logSearch({ q: needle, source: "search", picked: `product:${p.id}` });
                }}
              >
                <ProductCard p={p} siblings={variantGroups[familyKey(p)]} editorial={editorial} />
              </div>
            ))}
          </div>
          {filtered.length > shown && (
            <div style={{ textAlign: "center", marginTop: 26 }}>
              <button onClick={() => setShown((n) => n + PAGE)} style={{ background: "#fff", border: "1px solid #E0E4ED", borderRadius: 10, padding: "11px 26px", fontSize: 13.5, fontWeight: 700, color: "#19202E", cursor: "pointer" }}>
                Show more · {filtered.length - shown} left
              </button>
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </main>
  );
}

const sheetH: React.CSSProperties = { fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6", margin: "14px 0 7px" };

const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 11.5,
  fontWeight: 600,
  padding: "7px 11px",
  borderRadius: 999,
  cursor: "pointer",
  border: `1px solid ${on ? "#4E5BDC" : "#E0E4ED"}`,
  background: on ? "#4E5BDC" : "#fff",
  color: on ? "#fff" : "#3A4358",
});

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
