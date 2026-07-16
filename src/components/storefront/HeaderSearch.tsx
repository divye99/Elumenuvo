"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { baseExGst } from "@/lib/pricing";

/**
 * Amazon-style header search: as-you-type dropdown with text completions
 * (typed part regular, completion bold), category-scoped suggestions
 * ("mcb in Switchgear"), product hits with thumbnail + price, recent
 * searches when the box is empty, and full keyboard navigation.
 */

type Term = { label: string; q: string; cat?: string };
type Hit = { id: string; name: string; brand: string; cat: string; price: number; image: string | null };
type Suggest = { terms: Term[]; products: Hit[] };

const RECENT_KEY = "elume.recentSearches";
const readRecents = (): string[] => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
const saveRecent = (q: string) => {
  try {
    const next = [q, ...readRecents().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* quota/disabled */ }
};

// One tiny module-level cache so backspacing through a query is instant.
const cache = new Map<string, Suggest>();

export default function HeaderSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sug, setSug] = useState<Suggest>({ terms: [], products: [] });
  const [recents, setRecents] = useState<string[]>([]);
  const [active, setActive] = useState(-1); // index into the flattened option list
  const boxRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── fetch suggestions, debounced, latest-wins ── */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) { setSug({ terms: [], products: [] }); setActive(-1); return; }
    const hit = cache.get(needle);
    if (hit) { setSug(hit); setActive(-1); return; }
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctl = new AbortController();
      abortRef.current = ctl;
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(needle)}`, { signal: ctl.signal });
        if (!r.ok) return;
        const data = (await r.json()) as Suggest;
        cache.set(needle, data);
        setSug(data);
        setActive(-1);
      } catch { /* aborted or offline: keep whatever is shown */ }
    }, 160);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [q]);

  /* ── close on outside click ── */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const showRecents = q.trim().length < 2;
  // The flattened option list drives keyboard navigation: recents OR
  // (terms then products), in visual order.
  const options = useMemo(() => {
    if (showRecents) return recents.map((r) => ({ kind: "recent" as const, label: r }));
    return [
      ...sug.terms.map((t) => ({ kind: "term" as const, ...t })),
      ...sug.products.map((p) => ({ kind: "product" as const, ...p })),
    ];
  }, [showRecents, recents, sug]);
  const hasPanel = open && options.length > 0;

  const goSearch = (needle: string, cat?: string) => {
    setOpen(false);
    if (needle) saveRecent(needle);
    const params = new URLSearchParams();
    if (needle) params.set("q", needle);
    if (cat) params.set("cat", cat);
    router.push(`/catalogue${params.size ? `?${params}` : ""}`);
  };

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return goSearch(q.trim());
    if (o.kind === "product") { setOpen(false); saveRecent(q.trim() || o.name); router.push(`/catalogue/${o.id}`); return; }
    if (o.kind === "recent") return goSearch(o.label);
    return goSearch(o.q, o.cat);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!hasPanel && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a <= 0 ? options.length - 1 : a - 1)); }
    else if (e.key === "Escape") { setOpen(false); setActive(-1); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); choose(active); }
  };

  /* Amazon bolds the COMPLETION, not the typed part. */
  const emphasize = (label: string) => {
    const needle = q.trim().toLowerCase();
    if (needle && label.toLowerCase().startsWith(needle)) {
      return (<>
        <span>{label.slice(0, needle.length)}</span>
        <b>{label.slice(needle.length)}</b>
      </>);
    }
    return <b>{label}</b>;
  };

  return (
    <form
      ref={boxRef}
      role="combobox"
      aria-expanded={hasPanel}
      aria-haspopup="listbox"
      onSubmit={(e) => { e.preventDefault(); if (active >= 0) choose(active); else goSearch(q.trim()); }}
      style={{ flex: 1, minWidth: 170, maxWidth: compact ? 420 : 560, position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "center", background: "#F3F5F9", border: `1px solid ${hasPanel ? "#C9CFF6" : "#E8EBF1"}`, borderRadius: 12, overflow: "hidden" }}>
        <span style={{ padding: "0 4px 0 14px", color: "#A0A7B5", fontSize: 15 }}>⌕</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => { setRecents(readRecents()); setOpen(true); }}
          onKeyDown={onKey}
          aria-autocomplete="list"
          placeholder="Search wires, MCBs, fans, switches, brands…"
          style={{ border: "none", outline: "none", fontSize: 14, width: "100%", padding: "10px 10px", background: "transparent", color: "#19202E" }}
        />
        <button type="submit" aria-label="Search" style={{ border: "none", cursor: "pointer", background: "#4E5BDC", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 18px" }}>
          Search
        </button>
      </div>

      {hasPanel && (
        <div role="listbox" style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60, background: "#fff", border: "1px solid #E0E4ED", borderRadius: 12, boxShadow: "0 16px 40px rgba(20,24,45,.14)", overflow: "hidden", padding: "6px 0" }}>
          {showRecents && (
            <div style={{ padding: "6px 16px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#A0A7B5" }}>Recent searches</div>
          )}
          {options.map((o, i) => {
            const isActive = i === active;
            const rowBase: React.CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "8px 16px", cursor: "pointer", background: isActive ? "#F3F5F9" : "#fff" };
            if (o.kind === "product") {
              const first = options.findIndex((x) => x.kind === "product") === i;
              return (
                <div key={`p-${o.id}`}>
                  {first && <div style={{ borderTop: options.some((x) => x.kind !== "product") ? "1px solid #F0F2F6" : undefined, margin: "4px 0", paddingTop: 4 }}>
                    <div style={{ padding: "2px 16px 4px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#A0A7B5" }}>Products</div>
                  </div>}
                  <div role="option" aria-selected={isActive} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(i); }} style={rowBase}>
                    <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 8, border: "1px solid #EEF0F4", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {o.image ? <img src={o.image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 2, boxSizing: "border-box" }} /> : <span style={{ fontSize: 15 }}>🔌</span>}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</span>
                      <span style={{ fontSize: 11, color: "#8A93A6" }}>{o.brand} · {o.cat}</span>
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "#19202E", whiteSpace: "nowrap" }}>{fmt(baseExGst(o.price, o.cat))} <span style={{ fontSize: 9.5, color: "#8A93A6", fontWeight: 600 }}>+GST</span></span>
                  </div>
                </div>
              );
            }
            return (
              <div key={`${o.kind}-${"label" in o ? o.label : i}-${"cat" in o ? o.cat ?? "" : ""}`} role="option" aria-selected={isActive} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); choose(i); }} style={rowBase}>
                <span style={{ color: "#A0A7B5", fontSize: 13, width: 16, textAlign: "center" }}>{o.kind === "recent" ? "↺" : "⌕"}</span>
                <span style={{ fontSize: 13.5, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {o.kind === "recent" ? o.label : emphasize(o.label)}
                  {o.kind === "term" && o.cat && <span style={{ color: "#4E5BDC", fontSize: 12 }}> in {o.cat}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </form>
  );
}
