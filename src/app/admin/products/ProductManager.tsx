"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { wholesalePrice, offMrpPct, gstBreakdown } from "@/lib/pricing";
import { catalogueToCsv } from "@/lib/admin/import";
import type { ProductRow } from "@/lib/admin/data";
import ImportClient from "@/app/admin/products/import/ImportClient";

/* Admin mutations go through the fixed /api/admin/rpc URL (server-action ids
 * rotate per deploy). Wrappers keep the original signatures so call sites
 * are unchanged. */
async function rpc<T = { ok: boolean; error?: string }>(payload: Record<string, unknown>): Promise<T> {
  const r = await fetch("/api/admin/rpc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  try { return await r.json(); } catch { return { ok: false, error: `Request failed (${r.status}). Try again.` } as T; }
}

const updateProductDetails = (input: Record<string, unknown>) => rpc({ op: "update-product", input });
const deleteProduct = async (fd: FormData) => { await rpc({ op: "delete-product", id: String(fd.get("id") ?? "") }); };
const searchCompetitorAction = (source: string, query: string) => rpc<any>({ op: "search-competitor", source, query });
const saveCompetitorMap = (input: Record<string, unknown>) => rpc({ op: "save-map", input });
const removeCompetitorMap = (productId: string, source: string) => rpc({ op: "remove-map", productId, source });
const updateMapCondition = (productId: string, source: string, condition: string) => rpc({ op: "map-condition", productId, source, condition });
const setMapApproval = (productId: string, source: string, approve: boolean) => rpc({ op: "map-approval", productId, source, approve });
const acceptSuggestion = (productId: string, source: string) => rpc({ op: "accept-suggestion", productId, source });
async function applyRecommendedPrices(items: { id: string; target: number }[]) {
  const r = await fetch("/api/admin/radar/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "apply-all", items }) });
  try { return await r.json(); } catch { return { ok: false, error: "Request failed. Try again." }; }
}

export type SourceInfo = { id: string; name: string; siteUrl: string | null; enabled: boolean };

type PriceCell = {
  competitor_name: string | null;
  competitor_url: string | null;
  list_price: number | null;
  net_price: number | null;
  unit_factor: number | null;
  comparable_price: number | null;
  suggested_price: number | null;
  status: string;
  in_stock: boolean | null;
  fetched_at: string;
} | null;

export type MapCell = { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null; item_condition: string | null; competitor_brand_sku: string | null; approval: "approved" | "pending" | null; match_method: string | null } | null;

export type ManagerRow = {
  id: string;
  name: string;
  sku: string;
  brand_sku: string | null;
  brand: string;
  category: string;
  spec: string | null;
  unit: string;
  mrp: number;
  elume_price: number;
  is_active: boolean;
  is_recommended: boolean;
  parent_id: string | null;
  attrs: Record<string, string> | null;
  sort_order: number;
  image_url: string | null;
  suggestedFactor: number;
  perSource: Record<string, { map: MapCell; price: PriceCell }>;
};

type Hit = { code: string; name: string; brand: string | null; listPrice: number | null; netPrice: number | null; url: string | null };

type MapView = "all" | "mapped" | "unmapped" | "multi";

export default function ProductManager({ rows, sources }: { rows: ManagerRow[]; sources: SourceInfo[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [view, setView] = useState<MapView>("all");
  const [sellersN, setSellersN] = useState<"any" | number>("any"); // exact number of sellers mapped
  const [priceView, setPriceView] = useState<"any" | "cheaper" | "winning">("any");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showImport, setShowImport] = useState(false);
  const [applying, startApply] = useTransition();
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const router = useRouter();

  // How many competitor sellers this product is mapped to.
  const mappedCount = (r: ManagerRow) => sources.filter((s) => r.perSource[s.id]?.map).length;

  const cats = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()], [rows]);

  // Distinct seller-counts present, each with how many products have exactly that many.
  const sellerBuckets = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows) { const n = sources.filter((s) => r.perSource[s.id]?.map).length; m.set(n, (m.get(n) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sources]);

  /* ── Price suggestions ──
   * A seller only counts if the mapping is APPROVED and the listing is BUYABLE
   * (in stock, real >0 price) — a pending match or an out-of-stock competitor
   * must never drag our price down. Suggestion = undercut the cheapest such
   * seller by ₹1, and only when they are actually cheaper than us today. */
  const sellerPrice = (r: ManagerRow, s: SourceInfo): number | null => {
    const cell = r.perSource[s.id];
    if (!cell?.map || cell.map.approval === "pending") return null;
    const p = cell.price;
    if (!p || p.status === "unavailable" || p.in_stock === false) return null;
    return p.comparable_price != null && p.comparable_price > 0 ? p.comparable_price : null;
  };
  const lowestFor = (r: ManagerRow): number | null => {
    const ps = sources.map((s) => sellerPrice(r, s)).filter((v): v is number => v != null);
    return ps.length ? Math.min(...ps) : null;
  };
  /** The price we'd move to: ₹1 under the cheapest live competitor. */
  const targetFor = (r: ManagerRow): number | null => {
    const lo = lowestFor(r);
    return lo != null ? Math.max(1, Math.round(lo) - 1) : null;
  };
  /** A competitor is genuinely cheaper than us today, and the move is real. */
  const needsReprice = (r: ManagerRow): boolean => {
    const lo = lowestFor(r);
    const t = targetFor(r);
    return lo != null && lo < r.elume_price && t != null && t !== Math.round(r.elume_price);
  };
  /** We're already at or under every live competitor. */
  const isWinning = (r: ManagerRow): boolean => {
    const lo = lowestFor(r);
    return lo != null && lo >= r.elume_price;
  };

  // Counts for the mapping-status dropdown labels.
  const counts = useMemo(() => {
    let mapped = 0, unmapped = 0, multi = 0;
    for (const r of rows) {
      const n = mappedCount(r);
      if (n === 0) unmapped++; else { mapped++; if (n > 1) multi++; }
    }
    return { all: rows.length, mapped, unmapped, multi };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sources]);

  const [sortBy, setSortBy] = useState<"default" | "priceAsc" | "priceDesc" | "mrpAsc" | "mrpDesc" | "name">("default");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (cat !== "All" && r.category !== cat) return false;
      if (needle && !`${r.name} ${r.sku} ${r.brand}`.toLowerCase().includes(needle)) return false;
      const n = mappedCount(r);
      if (view === "mapped" && n === 0) return false;
      if (view === "unmapped" && n !== 0) return false;
      if (view === "multi" && n < 2) return false;
      if (sellersN !== "any" && n !== sellersN) return false;
      if (priceView === "cheaper" && !needsReprice(r)) return false;
      if (priceView === "winning" && !isWinning(r)) return false;
      return true;
    });
    switch (sortBy) {
      case "priceAsc": return [...list].sort((a, b) => Number(a.elume_price) - Number(b.elume_price));
      case "priceDesc": return [...list].sort((a, b) => Number(b.elume_price) - Number(a.elume_price));
      case "mrpAsc": return [...list].sort((a, b) => Number(a.mrp) - Number(b.mrp));
      case "mrpDesc": return [...list].sort((a, b) => Number(b.mrp) - Number(a.mrp));
      case "name": return [...list].sort((a, b) => a.name.localeCompare(b.name));
      default: return list;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, cat, view, sellersN, priceView, sortBy, sources]);

  const suggestionCount = useMemo(() => rows.filter(needsReprice).length, [rows, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Apply "₹1 under the cheapest live competitor" to every currently-filtered
   *  product that has a real suggestion. Confirmed first — this changes live
   *  storefront prices. */
  const applyAllSuggestions = () => {
    const items = filtered.filter(needsReprice).map((r) => ({ id: r.id, target: targetFor(r) as number }));
    if (items.length === 0) return;
    const ok = window.confirm(
      `Apply ${items.length} price suggestion${items.length === 1 ? "" : "s"}?\n\n` +
        `Each product will be repriced to ₹1 under its cheapest in-stock competitor. ` +
        `This changes live storefront prices immediately.`
    );
    if (!ok) return;
    setApplyMsg(null);
    startApply(async () => {
      try {
        const res = await applyRecommendedPrices(items);
        if (res.ok) {
          setApplyMsg({ ok: true, t: `Applied ${res.applied} price${res.applied === 1 ? "" : "s"}${res.skipped ? ` · ${res.skipped} skipped` : ""}.` });
          router.refresh();
        } else setApplyMsg({ ok: false, t: res.error ?? "Failed to apply." });
      } catch {
        setApplyMsg({ ok: false, t: "The site was updated while this page was open. Reload the page and try again." });
      }
    });
  };

  /* ── Selection (for the Excel template download) ── */
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleOne = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleVisible = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allVisibleSelected) filtered.forEach((r) => n.delete(r.id));
      else filtered.forEach((r) => n.add(r.id));
      return n;
    });
  const selectAll = () => setSelected(new Set(rows.map((r) => r.id)));
  const clearSelection = () => setSelected(new Set());

  /** Download the SELECTED products as the same CSV the bulk importer accepts —
   *  edit in Excel, then upload right back in the import panel below. */
  const downloadSelected = () => {
    const chosen = rows.filter((r) => selected.has(r.id));
    if (chosen.length === 0) return;
    const csvRows = chosen.map((r) => ({
      id: r.id, sku: r.sku, brand_sku: r.brand_sku, name: r.name, brand: r.brand,
      category: r.category, spec: r.spec, mrp: r.mrp, elume_price: r.elume_price,
      unit: r.unit, attrs: r.attrs, parent_id: r.parent_id, sort_order: r.sort_order,
      is_active: r.is_active, image_url: r.image_url, is_recommended: r.is_recommended, units_sold: 0,
    })) as unknown as ProductRow[];
    const blob = new Blob([catalogueToCsv(csvRows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `elume-products-selected-${chosen.length}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, brand…" style={{ flex: "1 1 240px", minWidth: 200, border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 13px", fontSize: 13.5, outline: "none" }} />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff" }}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={view} onChange={(e) => setView(e.target.value as MapView)} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff", fontWeight: 600 }}>
          <option value="all">All mapping status ({counts.all})</option>
          <option value="mapped">Mapped ({counts.mapped})</option>
          <option value="unmapped">Price unmapped ({counts.unmapped})</option>
          <option value="multi">Multi-seller · 2+ ({counts.multi})</option>
        </select>
        <select value={String(sellersN)} onChange={(e) => setSellersN(e.target.value === "any" ? "any" : Number(e.target.value))} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff" }}>
          <option value="any">Sellers mapped: any</option>
          {sellerBuckets.map(([n, count]) => (
            <option key={n} value={n}>{n} seller{n === 1 ? "" : "s"} ({count})</option>
          ))}
        </select>
        <select value={priceView} onChange={(e) => setPriceView(e.target.value as typeof priceView)} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff", fontWeight: priceView !== "any" ? 700 : 400, color: priceView === "cheaper" ? "#C0392B" : undefined }}>
          <option value="any">Price: all</option>
          <option value="cheaper">⚠ Competitor cheaper — needs repricing ({suggestionCount})</option>
          <option value="winning">✓ We&apos;re at or under every competitor</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff" }}>
          <option value="default">Sort: default</option>
          <option value="priceAsc">Elume price: low → high</option>
          <option value="priceDesc">Elume price: high → low</option>
          <option value="mrpAsc">MRP: low → high</option>
          <option value="mrpDesc">MRP: high → low</option>
          <option value="name">Name A → Z</option>
        </select>
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{filtered.length} shown</span>
      </div>

      {/* Price-suggestion bar: only when the current filter contains suggestions */}
      {filtered.some(needsReprice) && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14, background: "#FFF9EE", border: "1px solid #F0DFC0", borderRadius: 12, padding: "11px 14px" }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#8a6116" }}>
              {filtered.filter(needsReprice).length} product{filtered.filter(needsReprice).length === 1 ? "" : "s"} priced above a live competitor
            </div>
            <div style={{ fontSize: 11.5, color: "#8A93A6" }}>
              Applying reprices each to ₹1 under its cheapest in-stock competitor. Out-of-stock and unapproved matches are ignored.
            </div>
          </div>
          {applyMsg && (
            <span style={{ fontSize: 12.5, fontWeight: 600, color: applyMsg.ok ? "#137a4b" : "#C0392B" }}>{applyMsg.t}</span>
          )}
          <button
            onClick={applyAllSuggestions}
            disabled={applying}
            style={{ marginLeft: "auto", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none", padding: "10px 18px", borderRadius: 10, cursor: applying ? "wait" : "pointer", opacity: applying ? 0.6 : 1, whiteSpace: "nowrap" }}
          >
            {applying ? "Applying…" : `✓ Apply all ${filtered.filter(needsReprice).length} price suggestions`}
          </button>
        </div>
      )}

      {/* Selection + Excel tools */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "9px 14px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, color: "#3A4358", cursor: "pointer" }}>
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
          Select visible ({filtered.length})
        </label>
        <button onClick={selectAll} style={selLink}>Select all {rows.length}</button>
        {selected.size > 0 && <button onClick={clearSelection} style={{ ...selLink, color: "#C0392B" }}>Clear</button>}
        {selected.size > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#3A46B8", background: "#EEF0FE", padding: "3px 10px", borderRadius: 999 }}>
            {selected.size} selected
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={downloadSelected} disabled={selected.size === 0} title={selected.size === 0 ? "Select products first — tick rows, or use Select visible / Select all" : `Download ${selected.size} products as an editable CSV`} style={{ ...ghost, opacity: selected.size === 0 ? 0.5 : 1, cursor: selected.size === 0 ? "default" : "pointer" }}>
            ⬇ Download template{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
          <button onClick={() => setShowImport((v) => !v)} style={showImport ? { ...primary, background: "#161D2B" } : ghost}>
            ⇅ Excel import {showImport ? "▴" : "▾"}
          </button>
        </div>
      </div>

      {/* Inline Excel import — same page, no navigation */}
      {showImport && (
        <div style={{ marginBottom: 16 }}>
          <ImportClient />
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        {filtered.map((r, i) => {
          const open = openId === r.id;
          const sug = needsReprice(r);
          const sugTarget = sug ? targetFor(r) : null;
          const n = mappedCount(r);
          return (
            <div key={r.id} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              {/* Summary row */}
              <div onClick={() => setOpenId(open ? null : r.id)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", background: open ? "#FAFBFE" : selected.has(r.id) ? "#F7F8FF" : undefined }}>
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleOne(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select ${r.name}`}
                  style={{ flexShrink: 0, cursor: "pointer" }}
                />
                <span style={{ color: "#8A93A6", fontSize: 12, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", width: 12 }}>▶</span>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7 }}>
                    {r.name}
                    <a href={`/catalogue/${r.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Open the live product page" style={{ color: "#4E5BDC", fontSize: 11.5, fontWeight: 700 }}>↗</a>
                    {!r.is_active && <Tag color="#E0612A">hidden</Tag>}
                    {r.parent_id && <Tag color="#8A93A6">variant</Tag>}
                    {r.is_recommended && <Tag color="#4E5BDC">rec</Tag>}
                  </div>
                  <div style={{ fontFamily: "var(--space-mono)", fontSize: 11, color: "#8A93A6" }}>{r.brand} · {r.sku}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(r.elume_price)}</div>
                  <div style={{ fontSize: 11, color: "#A0A7B5" }}>MRP {fmt(r.mrp)}</div>
                </div>
                <span
                  title={n === 0 ? "Not mapped to any competitor" : `Mapped to ${n} seller${n === 1 ? "" : "s"}`}
                  style={{ fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap", borderRadius: 20, padding: "2px 9px", color: n === 0 ? "#C0392B" : n > 1 ? "#137a4b" : "#C77700", background: n === 0 ? "#FBE9E4" : n > 1 ? "#E6F5EE" : "#FFF3E0" }}
                >
                  {n === 0 ? "unmapped" : n > 1 ? `${n} sellers` : "1 seller"}
                </span>
                {sug && sugTarget != null && (
                  <span
                    title={`A live competitor sells this for ${fmt(lowestFor(r)!)} — undercut to ${fmt(sugTarget)}`}
                    style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}
                  >
                    ↓ {fmt(sugTarget)}
                  </span>
                )}
              </div>

              {open && <ExpandedPanel row={r} sources={sources} onClose={() => setOpenId(null)} />}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 24, fontSize: 13, color: "#8A93A6", textAlign: "center" }}>No matching products.</div>}
      </div>
    </div>
  );
}

function ExpandedPanel({ row, sources, onClose }: { row: ManagerRow; sources: SourceInfo[]; onClose: () => void }) {
  const [tab, setTab] = useState<"details" | "competitor">("details");
  return (
    <div style={{ borderTop: "1px solid #EEF0F4", background: "#F7F8FB", padding: "4px 16px 18px" }}>
      <div style={{ display: "flex", gap: 4, margin: "10px 0 14px" }}>
        <TabBtn on={tab === "details"} onClick={() => setTab("details")}>Details</TabBtn>
        <TabBtn on={tab === "competitor"} onClick={() => setTab("competitor")}>Competitor pricing</TabBtn>
      </div>
      {tab === "details" ? <DetailsTab row={row} onClose={onClose} /> : <CompetitorTab row={row} sources={sources} />}
    </div>
  );
}

/* ── Tab 1: Details ── */
function DetailsTab({ row, onClose }: { row: ManagerRow; onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: row.name, brand_sku: row.brand_sku ?? "", spec: row.spec ?? "", unit: row.unit,
    mrp: String(row.mrp), elume_price: String(row.elume_price),
    is_active: row.is_active, is_recommended: row.is_recommended,
    Size: row.attrs?.Size ?? "", Length: row.attrs?.Length ?? "", Colour: row.attrs?.Colour ?? "", Quality: row.attrs?.Quality ?? "", Pack: row.attrs?.Pack ?? "",
  });
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const mrp = Number(f.mrp), elume = Number(f.elume_price);
  const valid = mrp > 0 && elume > 0;

  const save = () =>
    start(async () => {
      const res = await updateProductDetails({
        id: row.id, name: f.name, brand_sku: f.brand_sku, spec: f.spec, unit: f.unit, mrp, elume_price: elume,
        is_active: f.is_active, is_recommended: f.is_recommended,
        attrs: { Size: f.Size, Length: f.Length, Colour: f.Colour, Quality: f.Quality, Pack: f.Pack },
      });
      setMsg(res.ok ? { ok: true, t: "Saved." } : { ok: false, t: res.error ?? "Failed." });
      if (res.ok) router.refresh();
    });

  const del = () => start(async () => { const fd = new FormData(); fd.set("id", row.id); await deleteProduct(fd); router.refresh(); });

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginBottom: 12 }}>
        <Field label="Name"><input value={f.name} onChange={set("name")} style={inp} /></Field>
        <Field label="Unit"><input value={f.unit} onChange={set("unit")} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
        <Field label="Brand SKU / MPN"><input value={f.brand_sku} onChange={set("brand_sku")} style={inp} placeholder="e.g. AHEFBXW160" /></Field>
        <Field label="Spec"><input value={f.spec} onChange={set("spec")} style={inp} /></Field>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, margin: "12px 0" }}>
        <Field label="MRP (₹ incl. GST)"><input type="number" step="any" value={f.mrp} onChange={set("mrp")} style={inp} /></Field>
        <Field label="Elume price (₹ incl. GST)"><input type="number" step="any" value={f.elume_price} onChange={set("elume_price")} style={{ ...inp, fontWeight: 700, borderColor: "#C9CFF6" }} /></Field>
        <div style={{ alignSelf: "end", fontSize: 12, color: "#56627A", paddingBottom: 8 }}>
          {valid ? (() => { const gb = gstBreakdown(elume, row.category); return <>{offMrpPct(elume, mrp)}% off · wholesale {fmt(wholesalePrice(elume))} · storefront shows <b>{fmt(gb.base)}</b> + {Math.round(gb.rate * 100)}% GST</>; })() : "—"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
        {(["Size", "Length", "Colour", "Quality", "Pack"] as const).map((a) => (
          <Field key={a} label={a}><input value={f[a]} onChange={set(a)} style={inp} placeholder={a === "Length" ? "90 m" : ""} /></Field>
        ))}
      </div>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        <label style={ckLabel}><input type="checkbox" checked={f.is_active} onChange={set("is_active")} /> Active</label>
        <label style={ckLabel}><input type="checkbox" checked={f.is_recommended} onChange={set("is_recommended")} /> Recommended</label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#137a4b" : "#C0392B" }}>{msg.t}</span>}
          <button onClick={del} disabled={busy} style={{ ...ghost, color: "#C0392B" }}>Delete</button>
          <button onClick={save} disabled={busy || !valid} style={{ ...primary, opacity: busy || !valid ? 0.6 : 1 }}>{busy ? "Saving…" : "Save details"}</button>
        </div>
      </div>
    </div>
  );
}

const CONDITIONS = ["New", "Refurbished", "Open box"];

/* ── Tab 2: Competitor pricing — LIST of every matched seller ── */
function CompetitorTab({ row, sources }: { row: ManagerRow; sources: SourceInfo[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [adding, setAdding] = useState(false);

  // Every source this product is currently mapped to → one list row each.
  const mappedSellers = sources.filter((s) => row.perSource[s.id]?.map);
  // Sources still available to add a mapping for.
  const openSources = sources.filter((s) => s.enabled && !row.perSource[s.id]?.map);

  // A seller counts only if APPROVED and BUYABLE (in stock + real >0 price).
  // Pending matches and out-of-stock / no-price sellers never drive the cheapest.
  const isAvailable = (s: SourceInfo) => {
    const pr = row.perSource[s.id].price;
    return !!pr && pr.status !== "unavailable" && pr.in_stock !== false && pr.comparable_price != null && pr.comparable_price > 0;
  };
  const comparables = mappedSellers
    .filter((s) => row.perSource[s.id].map?.approval !== "pending" && isAvailable(s))
    .map((s) => row.perSource[s.id].price!.comparable_price as number);
  const lowest = comparables.length ? Math.min(...comparables) : null;

  const setCondition = (source: string, condition: string) =>
    start(async () => { const res = await updateMapCondition(row.id, source, condition); if (res.ok) router.refresh(); else setMsg({ ok: false, t: res.error ?? "Failed." }); });
  const unmap = (source: string) => start(async () => { await removeCompetitorMap(row.id, source); router.refresh(); });
  const decide = (source: string, approve: boolean) =>
    start(async () => { const res = await setMapApproval(row.id, source, approve); if (res.ok) { setMsg({ ok: true, t: approve ? "Mapping approved." : "Mapping rejected & removed." }); router.refresh(); } else setMsg({ ok: false, t: res.error ?? "Failed." }); });
  const accept = (source: string, suggested: number) =>
    start(async () => { const res = await acceptSuggestion(row.id, source); setMsg(res.ok ? { ok: true, t: `Elume price set to ${fmt(suggested)}.` } : { ok: false, t: res.error ?? "Failed." }); if (res.ok) router.refresh(); });

  return (
    <div>
      {/* Match key: brand SKU (Layer 1) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, fontSize: 12.5, color: "#56627A" }}>
        <span>Match key ·</span>
        {row.brand_sku
          ? <span style={{ fontFamily: "var(--space-mono)", background: "#EEF0FE", color: "#3A46B8", padding: "3px 9px", borderRadius: 7, fontWeight: 600 }}>Brand SKU {row.brand_sku}</span>
          : <span style={{ color: "#C77700", background: "#FFF3E0", padding: "3px 9px", borderRadius: 7, fontWeight: 600 }}>No brand SKU set — add it in Details for reliable cross-site matching</span>}
        <span style={{ color: "#A0A7B5" }}>· our price <b style={{ color: "#4E5BDC" }}>{fmt(row.elume_price)}</b></span>
      </div>

      {msg && <div style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#137a4b" : "#C0392B", marginBottom: 10 }}>{msg.t}</div>}

      {/* Seller list */}
      {mappedSellers.length > 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden" }}>
          {/* header */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.1fr 0.9fr 0.85fr 0.7fr auto", gap: 10, padding: "9px 14px", background: "#F7F8FB", borderBottom: "1px solid #EEF0F4", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "#8A93A6" }}>
            <span>Seller</span><span>Competitor price</span><span>Availability</span><span>Condition</span><span>Link</span><span />
          </div>
          {mappedSellers.map((s, i) => {
            const cell = row.perSource[s.id];
            const p = cell.price;
            const map = cell.map!;
            const comparable = p?.comparable_price ?? null;
            const available = isAvailable(s);
            const oos = !!p && !available; // synced but not buyable (out of stock / no price)
            const isCheapest = available && comparable != null && lowest != null && comparable === lowest && comparables.length > 1;
            // Prefer the price snapshot's URL: the sync refreshes it with the
            // store's canonical link, while map.competitor_url can be stale.
            const url = p?.competitor_url ?? map.competitor_url ?? null;
            const canReprice = available && p?.suggested_price != null && p.suggested_price !== Math.round(row.elume_price);
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.1fr 0.9fr 0.85fr 0.7fr auto", gap: 10, padding: "11px 14px", borderTop: i ? "1px solid #F5F6F9" : undefined, alignItems: "center" }}>
                {/* Seller */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {s.name}
                    {isCheapest && <span style={{ fontSize: 9, fontWeight: 700, color: "#137a4b", background: "#E6F5EE", padding: "1px 6px", borderRadius: 6 }}>LOWEST</span>}
                    {map.match_method === "brand-sku" && <span title="Matched on the manufacturer part number" style={{ fontSize: 8.5, fontWeight: 800, color: "#3A46B8", background: "#EEF0FE", padding: "1px 6px", borderRadius: 5 }}>SKU</span>}
                    {map.approval === "pending" && <span title="Auto-matched by name - needs your approval" style={{ fontSize: 8.5, fontWeight: 800, color: "#C77700", background: "#FFF3E0", padding: "1px 6px", borderRadius: 5 }}>PENDING</span>}
                  </div>
                  <div style={{ fontFamily: "var(--space-mono)", fontSize: 10.5, color: "#8A93A6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={map.competitor_code}>{map.competitor_code}</div>
                </div>
                {/* Price (never applies when unavailable - shown struck-through if known) */}
                <div>
                  {available && comparable != null ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(comparable)}</div>
                      <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>
                        {p?.net_price != null ? `net ${fmt(p.net_price)}` : p?.list_price != null ? `list ${fmt(p.list_price)}` : ""}{(map.unit_factor ?? 1) !== 1 ? ` ·×${map.unit_factor}` : ""}
                      </div>
                    </>
                  ) : oos && (p?.net_price != null || p?.list_price != null) ? (
                    <div title="Last seen price - does not apply while unavailable" style={{ fontSize: 13, fontWeight: 600, color: "#A0A7B5", textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}>
                      {fmt((p!.net_price ?? p!.list_price)! * (map.unit_factor ?? 1))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: "#C4C9D4" }}>—</span>
                  )}
                </div>
                {/* Availability */}
                <div>
                  {!p ? (
                    <span style={availPill("#8A93A6", "#F0F2F6")}>Awaiting sync</span>
                  ) : available ? (
                    <span style={availPill("#137a4b", "#E6F5EE")}>● In stock</span>
                  ) : p.in_stock === false ? (
                    <span title="Out of stock on the competitor site - price does not apply" style={availPill("#C0392B", "#FBE9E4")}>● Out of stock</span>
                  ) : (
                    <span title="No valid price on the competitor site - does not apply" style={availPill("#C77700", "#FFF3E0")}>● No price</span>
                  )}
                </div>
                {/* Condition */}
                <select value={map.item_condition ?? "New"} onChange={(e) => setCondition(s.id, e.target.value)} disabled={busy} style={{ border: "1px solid #E0E4ED", borderRadius: 8, padding: "5px 7px", fontSize: 12, background: "#fff", maxWidth: "100%" }}>
                  {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
                  {map.item_condition && !CONDITIONS.includes(map.item_condition) && <option>{map.item_condition}</option>}
                </select>
                {/* Link */}
                <div style={{ minWidth: 0 }}>
                  {url
                    ? <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#4E5BDC" }}>Open ↗</a>
                    : <span style={{ fontSize: 12, color: "#C4C9D4" }}>—</span>}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
                  {map.approval === "pending" ? (
                    <>
                      <button onClick={() => decide(s.id, true)} disabled={busy} title="Approve — trust this match for pricing" style={{ background: "#137a4b", color: "#fff", fontWeight: 700, fontSize: 11.5, border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>✓ Approve</button>
                      <button onClick={() => decide(s.id, false)} disabled={busy} title="Reject — wrong match, remove it" style={{ background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 11.5, border: "1px solid #F0C8C0", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>✕ Reject</button>
                    </>
                  ) : (
                    <>
                      {canReprice && (
                        <button onClick={() => accept(s.id, p!.suggested_price!)} disabled={busy} title="Set our price to ₹1 under this seller" style={{ ...primary, fontSize: 11.5, padding: "6px 11px" }}>→ {fmt(p!.suggested_price!)}</button>
                      )}
                      <button onClick={() => unmap(s.id)} disabled={busy} aria-label={`Remove ${s.name}`} title="Remove this seller" style={{ background: "none", border: "none", color: "#C4C9D4", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px dashed #D5DAE4", borderRadius: 12, padding: "20px", textAlign: "center", fontSize: 12.5, color: "#8A93A6" }}>
          No sellers matched yet. Add one below — start with the brand SKU for an exact match.
        </div>
      )}

      {/* Add a seller */}
      <div style={{ marginTop: 12 }}>
        {adding ? (
          <AddSellerPanel row={row} openSources={openSources} onDone={() => { setAdding(false); router.refresh(); }} onCancel={() => setAdding(false)} />
        ) : (
          <button onClick={() => setAdding(true)} disabled={openSources.length === 0} style={{ ...ghost, opacity: openSources.length === 0 ? 0.5 : 1 }}>
            + Add a seller{openSources.length === 0 ? " (all mapped)" : ""}
          </button>
        )}
      </div>
      {mappedSellers.some((s) => row.perSource[s.id].map && !row.perSource[s.id].price) && (
        <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 8 }}>Some sellers are mapped but not priced yet — run a sync from <a href="/admin/radar" style={{ color: "#4E5BDC" }}>the radar</a>.</div>
      )}
    </div>
  );
}

/* Add-a-seller: pick an open source, then match (brand-SKU first). */
function AddSellerPanel({ row, openSources, onDone, onCancel }: { row: ManagerRow; openSources: SourceInfo[]; onDone: () => void; onCancel: () => void }) {
  const [source, setSource] = useState(openSources[0]?.id ?? "");
  const active = openSources.find((s) => s.id === source);
  return (
    <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#3A4358" }}>Add seller from</span>
        <select value={source} onChange={(e) => setSource(e.target.value)} style={{ border: "1px solid #E0E4ED", borderRadius: 9, padding: "7px 10px", fontSize: 13, background: "#fff" }}>
          {openSources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={onCancel} style={{ ...ghost, marginLeft: "auto", fontSize: 12 }}>Cancel</button>
      </div>
      {source && <MatchPicker row={row} source={source} sourceName={active?.name ?? source} onDone={onDone} />}
    </div>
  );
}

/** Does a competitor hit look like an exact brand-SKU (MPN) match? */
function skuMatch(hit: Hit, brandSku: string | null): boolean {
  if (!brandSku) return false;
  const norm = (s: string) => s.toLowerCase().replace(/[\s\-_./]/g, "");
  const key = norm(brandSku);
  if (key.length < 4) return false;
  return norm(hit.code).includes(key) || norm(hit.name).includes(key);
}

function MatchPicker({ row, source, sourceName, onDone }: { row: ManagerRow; source: string; sourceName: string; onDone: () => void }) {
  // Layer 1: search by brand SKU (MPN) first — it's the reliable cross-site key.
  const [query, setQuery] = useState(row.brand_sku || `${row.brand} ${row.name}`.replace(/—.*/, "").trim());
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [factor, setFactor] = useState(String(row.suggestedFactor));
  const [condition, setCondition] = useState("New");
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const runSearch = (term: string) => start(async () => {
    setErr(null);
    const results = (await searchCompetitorAction(source, term)) as Hit[];
    setHits(results);
    // Auto-pick a confident brand-SKU match when there's exactly one.
    const exact = results.filter((h) => skuMatch(h, row.brand_sku));
    if (exact.length === 1) setChosen(exact[0]);
  });
  const search = () => runSearch(query);

  const save = () => start(async () => {
    if (!chosen) { setErr("Pick a product first."); return; }
    const res = await saveCompetitorMap({
      product_id: row.id, source, competitor_code: chosen.code, competitor_url: chosen.url,
      unit_factor: Number(factor), item_condition: condition,
      competitor_brand_sku: skuMatch(chosen, row.brand_sku) ? row.brand_sku : null,
    });
    if (res.ok) onDone(); else setErr(res.error ?? "Failed.");
  });
  const chosenPrice = chosen ? (chosen.netPrice ?? chosen.listPrice) : null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, color: "#56627A", marginBottom: 10 }}>
        Find the matching product on {sourceName}
        {row.brand_sku
          ? <> — searching by brand SKU <b style={{ fontFamily: "var(--space-mono)" }}>{row.brand_sku}</b> for an exact match.</>
          : <> (tip: add a Brand SKU in Details for reliable auto-matching).</>}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={`Search ${sourceName}…`} style={{ ...inp, flex: 1, minWidth: 180 }} />
        <button onClick={search} disabled={busy} style={ghost}>{busy && !hits ? "Searching…" : "Search"}</button>
        {row.brand_sku && query !== `${row.brand} ${row.name}` && (
          <button onClick={() => { const t = `${row.brand} ${row.name}`.replace(/—.*/, "").trim(); setQuery(t); runSearch(t); }} disabled={busy} style={{ ...ghost, fontSize: 12 }} title="Fall back to name search">Search by name</button>
        )}
      </div>
      {hits && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E8EBF1", borderRadius: 9, marginBottom: 10 }}>
          {hits.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#8A93A6" }}>No results — try the name search or a shorter query.</div>}
          {hits.map((h) => {
            const price = h.netPrice ?? h.listPrice;
            const isSku = skuMatch(h, row.brand_sku);
            return (
              <button key={h.code} onClick={() => setChosen(h)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 10, alignItems: "center", padding: "9px 11px", border: "none", borderTop: "1px solid #F5F6F9", background: chosen?.code === h.code ? "#EEF0FE" : isSku ? "#F1FBF5" : "#fff", cursor: "pointer" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                    {isSku && <span style={{ flexShrink: 0, fontSize: 8.5, fontWeight: 800, color: "#137a4b", background: "#D9F2E4", padding: "1px 6px", borderRadius: 5 }}>SKU MATCH</span>}
                  </span>
                  <span style={{ fontSize: 11, color: "#8A93A6", fontFamily: "var(--space-mono)" }}>{h.brand} · {h.code}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{price != null ? fmt(price) : "—"}<span style={{ fontSize: 10, color: "#8A93A6" }}>/u</span></span>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Unit factor (× their price)"><input type="number" step="any" value={factor} onChange={(e) => setFactor(e.target.value)} style={{ ...inp, width: 120 }} /></Field>
        <Field label="Condition"><select value={condition} onChange={(e) => setCondition(e.target.value)} style={{ ...inp, width: 130 }}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <div style={{ fontSize: 11.5, color: "#8A93A6", flex: 1, minWidth: 140, paddingBottom: 8 }}>
          {chosen && chosenPrice != null ? <>Comparable ≈ <b>{fmt(chosenPrice * (Number(factor) || 1))}</b> vs our {fmt(row.elume_price)}</> : "Wire is per metre → 90 m coil uses ×90."}
        </div>
        <button onClick={save} disabled={busy || !chosen} style={{ ...primary, opacity: busy || !chosen ? 0.6 : 1 }}>Save mapping</button>
      </div>
      {err && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ── bits ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}1a`, padding: "1px 6px", borderRadius: 6 }}>{children}</span>;
}
function TabBtn({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 9, border: "1px solid " + (on ? "#161D2B" : "#E0E4ED"), background: on ? "#161D2B" : "#fff", color: on ? "#fff" : "#3A4358", cursor: "pointer" }}>{children}</button>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 11px", fontSize: 13, outline: "none", background: "#fff" };
const primary: React.CSSProperties = { background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", padding: "9px 18px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" };
const ghost: React.CSSProperties = { background: "#fff", color: "#19202e", fontWeight: 600, fontSize: 13, border: "1px solid #E0E4ED", padding: "8px 14px", borderRadius: 9, cursor: "pointer" };
const ckLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "#19202e" };
const selLink: React.CSSProperties = { background: "none", border: "none", color: "#4E5BDC", fontWeight: 600, fontSize: 12.5, cursor: "pointer", padding: "2px 4px" };
const availPill = (fg: string, bg: string): React.CSSProperties => ({ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" });
