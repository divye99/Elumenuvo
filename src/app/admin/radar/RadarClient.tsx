"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { gstBreakdown } from "@/lib/pricing";
import {
  searchCompetitorAction,
  saveCompetitorMap,
  removeCompetitorMap,
  setMapApproval,
  syncCompetitorNow,
  syncAllCompetitors,
  applyRecommendedPrice,
  applyRecommendedPrices,
  setElumePrice,
  saveRepricingRule,
  deleteRepricingRule,
} from "@/lib/admin/actions";
import type { RepricingRule } from "@/lib/admin/repricing";

export type SourceInfo = { id: string; name: string; siteUrl: string | null; enabled: boolean; needsLogin: boolean };

type PriceCell = {
  competitor_name: string | null;
  competitor_url: string | null;
  list_price: number | null;
  net_price: number | null;
  unit_factor: number | null;
  comparable_price: number | null;
  suggested_price: number | null;
  our_price: number | null;
  status: string;
  fetched_at: string;
} | null;

export type Seller = { source: string; sourceId: string; price: number | null; net: number | null; list: number | null; factor: number; code: string | null; url: string | null; condition: string | null; approval: string; available: boolean; inStock: boolean | null; synced: boolean };
export type Market = { sellers: Seller[]; avgMarket: number | null; lowest: number | null; target: number | null; pctVsLowest: number | null; cheapestSource: string | null; usableCount: number };
export type Rec = { basisPrice: number; target: number; changePct: number; blocked: string | null; basis: string; sellers?: number; cheapestSource?: string | null } | null;

export type RadarRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  image: string | null;
  ourPrice: number;
  mrp: number;
  suggestedFactor: number;
  mappedCount: number;
  pendingCount: number;
  perSource: Record<string, { map: { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null } | null; price: PriceCell }>;
  market: Market | null;
  rec: Rec;
};

type Hit = { code: string; name: string; brand: string | null; listPrice: number | null; netPrice: number | null; url: string | null };

export default function RadarClient({
  rows,
  sources,
  lastSync,
  rules,
  categories,
}: {
  rows: RadarRow[];
  sources: SourceInfo[];
  lastSync: { created_at: string; mapped: number; fetched: number; failed: number; suggestions: number; run_source: string; source: string } | null;
  rules: RepricingRule[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  // Filters (catalogue-style) + view + sort.
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [cat, setCat] = useState("");
  const [view, setView] = useState<"priced" | "unmapped" | "all">("priced");
  const [sellersN, setSellersN] = useState<"any" | number>("any"); // exact number of sellers mapped
  const [sort, setSort] = useState<"action" | "priceAsc" | "priceDesc" | "pct" | "name">("action");

  const brands = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows]);
  // Distinct seller-counts present, each with how many products have exactly that many.
  const sellerBuckets = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of rows) m.set(r.mappedCount, (m.get(r.mappedCount) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rows]);
  const needsAction = (r: RadarRow) => !!r.market && r.market.target != null && r.market.target !== Math.round(r.ourPrice);
  const actionCount = useMemo(() => rows.filter(needsAction).length, [rows]);
  const mapped = useMemo(() => rows.filter((r) => r.market), [rows]);
  const unmappedCount = useMemo(() => rows.filter((r) => r.mappedCount === 0).length, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = view === "unmapped" ? rows.filter((r) => r.mappedCount === 0) : view === "all" ? rows : rows.filter((r) => r.market);
    const list = base.filter(
      (r) =>
        (!needle || `${r.name} ${r.brand} ${r.category} ${r.id}`.toLowerCase().includes(needle)) &&
        (!brand || r.brand === brand) &&
        (!cat || r.category === cat) &&
        (sellersN === "any" || r.mappedCount === sellersN)
    );
    return [...list].sort((a, b) => {
      if (sort === "priceAsc") return a.ourPrice - b.ourPrice;
      if (sort === "priceDesc") return b.ourPrice - a.ourPrice;
      if (sort === "pct") return (b.market?.pctVsLowest ?? -999) - (a.market?.pctVsLowest ?? -999);
      if (sort === "name") return a.name.localeCompare(b.name);
      // "action" (default): products that need repricing first, biggest gap on top.
      const aa = needsAction(a) ? 1 : 0, bb = needsAction(b) ? 1 : 0;
      if (aa !== bb) return bb - aa;
      return Math.abs(b.market?.pctVsLowest ?? 0) - Math.abs(a.market?.pctVsLowest ?? 0);
    });
  }, [rows, view, q, brand, cat, sellersN, sort]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      try {
        const res = await fn();
        setFlash(res.ok ? { ok: true, msg: okMsg } : { ok: false, msg: res.error ?? "Failed." });
        if (res.ok) router.refresh();
      } catch {
        setFlash({ ok: false, msg: "The site was updated while this page was open. Reload the page and try again." });
      }
    });

  const syncAll = () =>
    startTransition(async () => {
      setFlash({ ok: true, msg: "Syncing every source… large sources may take a while." });
      const res = await syncAllCompetitors();
      if (res.ok && res.result) {
        const r = res.result;
        setFlash({ ok: true, msg: `Synced ${r.sources} source${r.sources === 1 ? "" : "s"} · ${r.fetched} prices · ${r.suggestions} to review${r.incomplete.length ? ` · timed out: ${r.incomplete.join(", ")} (use the GitHub Action)` : ""}.` });
        router.refresh();
      } else setFlash({ ok: false, msg: !res.ok && res.error ? res.error : "Sync failed." });
    });

  // Apply "lowest − ₹1" across all currently-filtered products that have a
  // buyable (in-stock, real-price) seller. Out-of-stock-only products have a
  // null target and are skipped.
  const applyAll = () => {
    const items = filtered
      .filter((r) => r.market && r.market.target != null && r.market.target !== Math.round(r.ourPrice))
      .map((r) => ({ id: r.id, target: r.market!.target as number }));
    if (items.length === 0) { setFlash({ ok: true, msg: "Everything already at the lowest available price − ₹1." }); return; }
    startTransition(async () => {
      const res = await applyRecommendedPrices(items);
      if (res.ok) { setFlash({ ok: true, msg: `Applied ${res.applied} price${res.applied === 1 ? "" : "s"} (lowest available − ₹1)${res.skipped ? ` · ${res.skipped} skipped` : ""}.` }); router.refresh(); }
      else setFlash({ ok: false, msg: res.error ?? "Failed." });
    });
  };

  const sel: React.CSSProperties = { border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 11px", fontSize: 13, background: "#fff" };

  return (
    <div>
      {/* Action bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={syncAll} disabled={pending} title="Refreshes live prices for mapped products. Mapping is done via the GitHub Action." style={{ background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 13.5, border: "none", padding: "10px 18px", borderRadius: 10, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
          {pending ? "Working…" : "↻ Refresh prices"}
        </button>
        <button onClick={applyAll} disabled={pending || filtered.length === 0} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none", padding: "10px 18px", borderRadius: 10, cursor: pending ? "wait" : "pointer", opacity: pending || filtered.length === 0 ? 0.55 : 1 }}>
          ✓ Apply lowest − ₹1 to all {filtered.length ? `(${filtered.length})` : ""}
        </button>
        {actionCount > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "3px 11px" }}>{actionCount} need repricing</span>}
        <span style={{ fontSize: 12, color: "#8A93A6", marginLeft: "auto" }}>
          {lastSync ? <>Last sync {new Date(lastSync.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</> : "Not synced yet"}
        </span>
      </div>

      {/* Filters + view + sort */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" style={{ ...sel, flex: "1 1 200px", minWidth: 160 }} />
        <select value={view} onChange={(e) => setView(e.target.value as any)} style={{ ...sel, fontWeight: 600 }}>
          <option value="priced">Priced ({mapped.length})</option>
          <option value="unmapped">Unmapped ({unmappedCount})</option>
          <option value="all">All ({rows.length})</option>
        </select>
        <select value={brand} onChange={(e) => setBrand(e.target.value)} style={sel}>
          <option value="">All brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={String(sellersN)} onChange={(e) => setSellersN(e.target.value === "any" ? "any" : Number(e.target.value))} style={sel}>
          <option value="any">Sellers mapped: any</option>
          {sellerBuckets.map(([n, count]) => (
            <option key={n} value={n}>{n} seller{n === 1 ? "" : "s"} ({count})</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={sel}>
          <option value="action">Sort: needs repricing first</option>
          <option value="priceAsc">Price: low → high</option>
          <option value="priceDesc">Price: high → low</option>
          <option value="pct">% vs lowest: high → low</option>
          <option value="name">Name: A → Z</option>
        </select>
      </div>

      {flash && <div style={{ background: flash.ok ? "#E6F5EE" : "#FBE9E4", color: flash.ok ? "#137a4b" : "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{flash.msg}</div>}

      <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 8 }}>{filtered.length} shown</div>

      {filtered.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "40px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          {view === "unmapped" ? "No unmapped products — everything is mapped 🎉" : mapped.length === 0 ? "No products have competitor prices yet. Map products in the section below, then Refresh prices." : "No products match the filters."}
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          {filtered.map((r, i) => <MappedRow key={r.id} r={r} first={i === 0} pending={pending} run={run} />)}
        </div>
      )}

      {/* Mapping tools (add/edit which competitor SKU each product maps to) */}
      <MappingSection rows={rows} sources={sources} lastSync={lastSync} pending={pending} run={run} startTransition={startTransition} setFlash={setFlash} router={router} />

      {/* Repricing rules (used by the monthly auto-sync) */}
      <div style={{ marginTop: 22 }}>
        <RulesPanel rules={rules} categories={categories} onSaved={(m) => { setFlash({ ok: true, msg: m }); router.refresh(); }} />
      </div>
    </div>
  );
}

/* ── One product row: detail + Elume / Avg / Lowest / %diff + accept + manual edit.
 *    Click the row to expand the per-seller mapping detail (price + link). ── */
function MappedRow({ r, first, pending, run }: { r: RadarRow; first: boolean; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) => void }) {
  const m = r.market;
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(String(r.ourPrice));
  const price = Number(val) || r.ourPrice;
  const hasLowest = !!m && m.lowest != null && m.lowest > 0;
  const pct = hasLowest ? Math.round(((price - m!.lowest!) / m!.lowest!) * 100) : null;
  const pctColor = pct == null ? "#8A93A6" : pct <= 0 ? "#137a4b" : "#C0392B";
  const canAccept = !!m && m.target != null && m.target !== Math.round(r.ourPrice);
  const canExpand = !!m && m.sellers.length > 0;
  const money = (n: number | null) => (n != null ? fmt(n) : "—");
  // Everything on this screen is GST-INCLUSIVE: that is how competitors list
  // their prices, so it is the only apples-to-apples basis for comparison. The
  // storefront shows the ex-GST base, so each figure carries it underneath.
  const exGst = (n: number | null) => (n != null ? `${fmt(gstBreakdown(n, r.category).base)} ex-GST` : undefined);

  return (
    <div style={{ borderTop: first ? undefined : "1px solid #F0F2F6" }}>
      <div style={{ padding: "13px 16px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {/* Product — clicking toggles the mapping detail */}
        <div onClick={() => canExpand && setOpen(!open)} style={{ display: "flex", gap: 11, alignItems: "center", flex: "1 1 300px", minWidth: 220, cursor: canExpand ? "pointer" : "default" }}>
          <div style={{ width: 46, height: 46, borderRadius: 9, background: "#F3F5F9", border: "1px solid #EEF0F4", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {r.image ? <img src={r.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 16 }}>🔌</span>}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis" }}>
              {canExpand && <span style={{ color: "#8A93A6", marginRight: 5, fontSize: 11 }}>{open ? "▾" : "▸"}</span>}{r.name}
            </div>
            {/* Coil length is shown for wires: it is part of the SKU's identity
                (a 90 m coil and a 180 m coil are different products at ~2x the
                price), so it has to be visible when judging a competitor match. */}
            <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{r.brand} · {r.category}{r.category === "Wires & Cables" && r.suggestedFactor > 1 ? ` · ${r.suggestedFactor} m coil` : ""}{m ? ` · ${m.sellers.length} seller${m.sellers.length === 1 ? "" : "s"}${m.usableCount < m.sellers.length ? ` (${m.usableCount} in stock)` : ""}` : r.mappedCount ? " · mapped, awaiting price" : " · not mapped"}</div>
          </div>
        </div>

        {m ? (
          <>
            <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
              <Stat label="Elume · incl. GST" value={editing ? undefined : fmt(r.ourPrice)} sub={exGst(editing ? price : r.ourPrice)}>
                {editing && <input autoFocus value={val} onChange={(e) => setVal(e.target.value.replace(/[^\d]/g, ""))} type="text" inputMode="numeric" style={{ width: 78, border: "1px solid #4E5BDC", borderRadius: 7, padding: "3px 7px", fontSize: 13, fontWeight: 700, textAlign: "right" }} />}
              </Stat>
              <Stat label="Avg market" value={money(m.avgMarket)} sub={exGst(m.avgMarket)} />
              <Stat label={`Lowest${m.cheapestSource ? ` · ${m.cheapestSource}` : ""}`} value={money(m.lowest)} sub={exGst(m.lowest)} />
              <Stat label="vs lowest" value={pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`} color={pctColor} />
            </div>
            <div style={{ display: "flex", gap: 8, marginLeft: "auto", alignItems: "center" }}>
              {editing ? (
                <>
                  <button onClick={() => run(() => setElumePrice(r.id, Number(val)), `${r.name} set to ${fmt(Number(val))}.`)} disabled={pending || !(Number(val) > 0)} style={btnAccept}>Save</button>
                  <button onClick={() => { setEditing(false); setVal(String(r.ourPrice)); }} style={linkBtn}>Cancel</button>
                </>
              ) : (
                <>
                  <button onClick={() => canAccept && run(() => applyRecommendedPrice(r.id, m.target!), `${r.name} set to ${fmt(m.target!)}.`)} disabled={pending || !canAccept} title={m.target == null ? "No buyable competitor price" : canAccept ? "" : "Already at lowest − ₹1"} style={{ ...btnAccept, opacity: pending || !canAccept ? 0.5 : 1 }}>{m.target != null ? `Accept ${fmt(m.target)}` : "No price"}</button>
                  <button onClick={() => { setEditing(true); setVal(String(r.ourPrice)); }} style={btnGhost}>Edit</button>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: "auto" }}>
            <Stat label="Elume · incl. GST" value={fmt(r.ourPrice)} sub={exGst(r.ourPrice)} />
            <span style={{ fontSize: 12, fontWeight: 600, color: r.mappedCount ? "#C77700" : "#C0392B", background: r.mappedCount ? "#FFF3E0" : "#FBE9E4", padding: "4px 10px", borderRadius: 8 }}>
              {r.pendingCount ? `${r.pendingCount} match${r.pendingCount === 1 ? "" : "es"} awaiting approval` : r.mappedCount ? "Mapped — run Refresh prices" : "Not mapped"}
            </span>
          </div>
        )}
      </div>

      {/* Expanded: every mapped seller with its price + a link to the competitor page */}
      {open && m && (
        <div style={{ background: "#F7F8FB", borderTop: "1px solid #EEF0F4", padding: "10px 16px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 6 }}>Mapped competitors</div>
          {m.sellers.slice().sort((a, b) => (Number(b.available) - Number(a.available)) || ((a.price ?? Infinity) - (b.price ?? Infinity))).map((s) => {
            const isPending = s.approval === "pending";
            const isLowest = s.available && s.price != null && s.price === m.lowest && !isPending;
            return (
              <div key={s.sourceId} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid #EEF0F4", fontSize: 12.5, flexWrap: "wrap", opacity: isPending || !s.available ? 0.85 : 1 }}>
                <span style={{ fontWeight: 700, minWidth: 130, color: isLowest ? "#137a4b" : "#19202E" }}>{s.source}{isLowest && <span style={{ fontSize: 10, marginLeft: 6, color: "#137a4b" }}>lowest</span>}</span>
                <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 700, minWidth: 80, color: s.available ? "#19202E" : "#A0A7B5" }}>{s.price != null ? fmt(s.price) : "—"}</span>
                <span style={{ color: "#8A93A6", fontSize: 11.5 }}>
                  {s.net != null ? `net ${fmt(s.net)}` : s.list != null ? `list ${fmt(s.list)}` : ""}{s.factor && s.factor !== 1 ? ` ×${s.factor}` : ""}
                </span>
                {s.code && <span style={{ fontFamily: "var(--space-mono)", fontSize: 10.5, color: "#8A93A6", background: "#EEF0F4", padding: "1px 6px", borderRadius: 5 }}>{s.code}</span>}
                <span style={{ fontSize: 10.5, fontWeight: 600, color: (s.condition ?? "New") === "New" ? "#137a4b" : "#C77700", background: (s.condition ?? "New") === "New" ? "#E6F5EE" : "#FFF3E0", padding: "1px 7px", borderRadius: 5 }}>{s.condition ?? "New"}</span>
                {!s.available && <span title={s.inStock === false ? "Out of stock on the competitor site" : !s.synced ? "Not synced yet" : "No valid price"} style={{ fontSize: 10, fontWeight: 800, color: "#C0392B", background: "#FBE9E4", padding: "1px 7px", borderRadius: 5 }}>{s.inStock === false ? "OUT OF STOCK" : !s.synced ? "NOT SYNCED" : "NO PRICE"}</span>}
                {isPending && <span title="Auto-matched by name — approve before it counts for pricing" style={{ fontSize: 10, fontWeight: 800, color: "#C77700", background: "#FFF3E0", padding: "1px 7px", borderRadius: 5 }}>PENDING</span>}
                <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                  {s.url && <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#4E5BDC", fontWeight: 600, fontSize: 12 }}>View on {s.source} ↗</a>}
                  {isPending && (
                    <>
                      <button onClick={() => run(() => setMapApproval(r.id, s.sourceId, true), "Mapping approved.")} disabled={pending} style={{ background: "#137a4b", color: "#fff", fontWeight: 700, fontSize: 11, border: "none", padding: "4px 10px", borderRadius: 7, cursor: "pointer" }}>✓ Approve</button>
                      <button onClick={() => run(() => setMapApproval(r.id, s.sourceId, false), "Mapping rejected & removed.")} disabled={pending} style={{ background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 11, border: "1px solid #F0C8C0", padding: "4px 10px", borderRadius: 7, cursor: "pointer" }}>✕ Reject</button>
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Mapping tools (collapsed): pick which competitor SKU each product maps to ── */
function MappingSection({ rows, sources, lastSync, pending, run, startTransition, setFlash, router }: any) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>(sources.find((s: SourceInfo) => s.enabled)?.id ?? sources[0]?.id ?? "vashi");
  const [q, setQ] = useState("");
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const active = sources.find((s: SourceInfo) => s.id === source);
  const mappedCount = rows.filter((r: RadarRow) => r.perSource[source]?.map).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows as RadarRow[]).filter((r) => !needle || `${r.name} ${r.brand} ${r.category} ${r.id}`.toLowerCase().includes(needle));
  }, [rows, q]);

  const syncOne = () =>
    startTransition(async () => {
      setFlash({ ok: true, msg: `Syncing ${active?.name}…` });
      const res = await syncCompetitorNow(source);
      if (res.ok && res.result) { setFlash({ ok: true, msg: `${active?.name}: synced ${res.result.fetched}/${res.result.mapped}.` }); router.refresh(); }
      else setFlash({ ok: false, msg: !res.ok && res.error ? res.error : "Sync failed." });
    });

  return (
    <div style={{ marginTop: 22, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Mapping & sources</span>
        <span style={{ fontSize: 12, color: "#8A93A6" }}>map products to competitor SKUs {open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #F0F2F6", padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {sources.map((s: SourceInfo) => {
              const on = s.id === source;
              return (
                <button key={s.id} onClick={() => s.enabled && setSource(s.id)} disabled={!s.enabled} style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 9, cursor: s.enabled ? "pointer" : "default", background: on ? "#161D2B" : "#fff", color: on ? "#fff" : s.enabled ? "#3A4358" : "#B4BAC6", border: `1px solid ${on ? "#161D2B" : "#E0E4ED"}` }}>
                  {s.name}{!s.enabled && <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.8 }}>off</span>}
                </button>
              );
            })}
            <button onClick={syncOne} disabled={pending || mappedCount === 0} style={{ marginLeft: "auto", background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 12.5, border: "none", padding: "7px 14px", borderRadius: 9, cursor: pending || mappedCount === 0 ? "default" : "pointer", opacity: pending || mappedCount === 0 ? 0.6 : 1 }}>↻ Sync {active?.name}</button>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" style={{ width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 10, padding: "8px 12px", fontSize: 13, marginBottom: 10 }} />
          <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 8 }}>{mappedCount}/{rows.length} mapped on {active?.name}</div>
          <div style={{ maxHeight: "52vh", overflowY: "auto", border: "1px solid #EEF0F4", borderRadius: 10 }}>
            {filtered.map((r, i) => {
              const cell = r.perSource[source] ?? { map: null, price: null };
              return (
                <div key={r.id} style={{ borderTop: i ? "1px solid #F4F5F8" : undefined }}>
                  <div style={{ padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "#8A93A6" }}>{r.brand} · {fmt(r.ourPrice)}/{r.unit}</div>
                    </div>
                    {cell.map ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11.5, fontFamily: "var(--space-mono)", background: "#F0F2F6", padding: "2px 7px", borderRadius: 6 }}>{cell.map.competitor_code}</span>
                        <span style={{ fontSize: 11.5, color: "#8A93A6" }}>×{cell.map.unit_factor}</span>
                        <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={linkBtn}>Edit</button>
                        <button onClick={() => run(() => removeCompetitorMap(r.id, source), "Mapping removed.")} disabled={pending} style={{ ...linkBtn, color: "#C0392B" }}>Remove</button>
                      </div>
                    ) : (
                      <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={{ ...btnGhost, fontSize: 12 }}>+ Map to {active?.name}</button>
                    )}
                  </div>
                  {pickerFor === r.id && <MatchPicker row={r} source={source} sourceName={active?.name ?? source} onDone={(msg: string) => { setPickerFor(null); setFlash({ ok: true, msg }); router.refresh(); }} onCancel={() => setPickerFor(null)} />}
                </div>
              );
            })}
          </div>
          {lastSync && <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 8 }}>For the full catalogue (or 800+ mapped items), use GitHub → Actions → “Competitor price sync”.</div>}
        </div>
      )}
    </div>
  );
}

function MatchPicker({ row, source, sourceName, onDone, onCancel }: { row: RadarRow; source: string; sourceName: string; onDone: (msg: string) => void; onCancel: () => void }) {
  const existing = row.perSource[source]?.map ?? null;
  const [query, setQuery] = useState(`${row.brand} ${row.name}`.replace(/—.*/, "").trim());
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [chosen, setChosen] = useState<Hit | null>(existing ? { code: existing.competitor_code, name: row.perSource[source]?.price?.competitor_name ?? existing.competitor_code, brand: row.brand, listPrice: null, netPrice: null, url: existing.competitor_url } : null);
  const [factor, setFactor] = useState(String(existing?.unit_factor ?? row.suggestedFactor));
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const search = () =>
    startTransition(async () => {
      setErr(null);
      const res = await searchCompetitorAction(source, query);
      setHits(res as Hit[]);
    });

  const save = () =>
    startTransition(async () => {
      if (!chosen) { setErr("Pick a product first."); return; }
      const res = await saveCompetitorMap({ product_id: row.id, source, competitor_code: chosen.code, competitor_url: chosen.url, unit_factor: Number(factor) });
      if (res.ok) onDone(`Mapped ${row.name} → ${chosen.code}. Run a sync to fetch its price.`);
      else setErr(res.error ?? "Failed to save.");
    });

  const chosenPrice = chosen ? (chosen.netPrice ?? chosen.listPrice) : null;

  return (
    <div style={{ background: "#F7F8FB", borderTop: "1px solid #EEF0F4", padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={`Search ${sourceName}…`} style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 11px", fontSize: 13 }} />
        <button onClick={search} disabled={busy} style={{ ...btnGhost, fontSize: 12.5 }}>{busy && !hits ? "Searching…" : "Search"}</button>
      </div>
      {hits && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E8EBF1", borderRadius: 9, background: "#fff", marginBottom: 10 }}>
          {hits.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#8A93A6" }}>No results — try a shorter query.</div>}
          {hits.map((h) => {
            const price = h.netPrice ?? h.listPrice;
            return (
              <button key={h.code} onClick={() => setChosen(h)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 10, alignItems: "center", padding: "9px 11px", border: "none", borderTop: "1px solid #F5F6F9", background: chosen?.code === h.code ? "#EEF0FE" : "transparent", cursor: "pointer" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202e", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: "#8A93A6", fontFamily: "var(--space-mono)" }}>{h.brand} · {h.code}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{price != null ? fmt(price) : "—"}<span style={{ fontSize: 10, color: "#8A93A6" }}>/u</span></span>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>Unit factor (× their price)</label>
          <input value={factor} onChange={(e) => setFactor(e.target.value)} type="number" step="any" style={{ width: 120, border: "1px solid #E0E4ED", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
        </div>
        <div style={{ fontSize: 11.5, color: "#8A93A6", flex: 1, minWidth: 160, paddingBottom: 8 }}>
          {chosen && chosenPrice != null ? <>Comparable ≈ <b>{fmt(chosenPrice * (Number(factor) || 1))}</b> vs our {fmt(row.ourPrice)}</> : "Wire priced per metre → a 90 m coil uses ×90."}
        </div>
        <div style={{ display: "flex", gap: 8, paddingBottom: 1 }}>
          <button onClick={save} disabled={busy || !chosen} style={{ ...btnAccept, opacity: busy || !chosen ? 0.6 : 1 }}>Save mapping</button>
          <button onClick={onCancel} disabled={busy} style={linkBtn}>Cancel</button>
        </div>
      </div>
      {err && <div style={{ color: "#C0392B", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

/* ── Repricing rules (used by the monthly auto-sync) ── */
function RulesPanel({ rules, categories, onSaved }: { rules: RepricingRule[]; categories: string[]; onSaved: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const global = rules.find((r) => r.scope === "global") ?? { scope: "global", basis: "cheapest" as const, delta: 1, delta_type: "rupees" as const, max_change_pct: 40, never_above_mrp: true, enabled: true };
  const overrides = rules.filter((r) => r.scope !== "global");

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#19202e" }}>Repricing rules <span style={{ fontWeight: 400, color: "#8A93A6" }}>(monthly auto-sync)</span></span>
        <span style={{ fontSize: 12, color: "#8A93A6" }}>{ruleSummary(global)}{overrides.length ? ` · ${overrides.length} override${overrides.length === 1 ? "" : "s"}` : ""} {open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid #F0F2F6", padding: "14px 16px" }}>
          <RuleEditor rule={global} categories={categories} usedScopes={rules.map((r) => r.scope)} onSaved={onSaved} isGlobal />
          {overrides.map((r) => <RuleEditor key={r.scope} rule={r} categories={categories} usedScopes={rules.map((x) => x.scope)} onSaved={onSaved} />)}
          <RuleEditor rule={{ ...global, scope: "" }} categories={categories} usedScopes={rules.map((r) => r.scope)} onSaved={onSaved} isNew />
        </div>
      )}
    </div>
  );
}

function ruleSummary(r: RepricingRule) {
  const d = r.delta_type === "percent" ? `${r.delta}%` : `₹${r.delta}`;
  return `${d} under ${r.basis === "cheapest" ? "lowest" : "market avg"}${r.never_above_mrp ? " · ≤ MRP" : ""}`;
}

function RuleEditor({ rule, categories, usedScopes, onSaved, isGlobal, isNew }: { rule: RepricingRule; categories: string[]; usedScopes: string[]; onSaved: (m: string) => void; isGlobal?: boolean; isNew?: boolean }) {
  const [f, setF] = useState(rule);
  const [busy, start] = useTransition();
  const availCats = categories.filter((c) => !usedScopes.includes(c) || c === rule.scope);

  const save = () => start(async () => {
    if (isNew && !f.scope) return;
    const res = await saveRepricingRule(f);
    if (res.ok) onSaved(isNew ? `Added rule for ${f.scope}.` : `Saved ${f.scope} rule.`);
  });
  const del = () => start(async () => { const res = await deleteRepricingRule(f.scope); if (res.ok) onSaved(`Removed ${f.scope} rule.`); });

  const sel: React.CSSProperties = { border: "1px solid #E0E4ED", borderRadius: 8, padding: "6px 9px", fontSize: 12.5, background: "#fff" };
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 0", borderTop: isGlobal ? undefined : "1px solid #F5F6F9" }}>
      {isGlobal ? <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 90 }}>All products</span>
        : isNew ? (
          <select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} style={{ ...sel, minWidth: 130 }}>
            <option value="">+ Category rule…</option>
            {availCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 90 }}>{f.scope}</span>}
      <span style={{ fontSize: 12, color: "#8A93A6" }}>price</span>
      <input type="number" step="any" value={f.delta} onChange={(e) => setF({ ...f, delta: Number(e.target.value) })} style={{ ...sel, width: 60 }} />
      <select value={f.delta_type} onChange={(e) => setF({ ...f, delta_type: e.target.value as any })} style={sel}>
        <option value="rupees">₹</option><option value="percent">%</option>
      </select>
      <span style={{ fontSize: 12, color: "#8A93A6" }}>under</span>
      <select value={f.basis} onChange={(e) => setF({ ...f, basis: e.target.value as any })} style={sel}>
        <option value="cheapest">lowest</option><option value="market_avg">market avg</option>
      </select>
      <label style={{ fontSize: 12, color: "#56627A", display: "flex", alignItems: "center", gap: 5 }}>
        max swing <input type="number" value={f.max_change_pct} onChange={(e) => setF({ ...f, max_change_pct: Number(e.target.value) })} style={{ ...sel, width: 48 }} />%
      </label>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        {!isGlobal && !isNew && <button onClick={del} disabled={busy} style={{ ...linkBtn, color: "#C0392B" }}>Remove</button>}
        <button onClick={save} disabled={busy || (isNew && !f.scope)} style={{ ...btnAccept, opacity: busy || (isNew && !f.scope) ? 0.6 : 1 }}>{isNew ? "Add" : "Save"}</button>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, color, children }: { label: string; value?: string; sub?: string; color?: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: "right", minWidth: 62 }}>
      <div style={{ fontSize: 10, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.3px", whiteSpace: "nowrap" }}>{label}</div>
      {children ?? <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "#19202e", fontVariantNumeric: "tabular-nums" }}>{value}</div>}
      {sub && <div style={{ fontSize: 10, color: "#A0A7B5" }}>{sub}</div>}
    </div>
  );
}

const btnAccept: React.CSSProperties = { background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 12.5, border: "none", padding: "8px 14px", borderRadius: 9, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#19202e", fontWeight: 600, fontSize: 12.5, border: "1px solid #E0E4ED", padding: "7px 13px", borderRadius: 9, cursor: "pointer" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "#4E5BDC", fontWeight: 600, fontSize: 12.5, cursor: "pointer" };
