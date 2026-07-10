"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { wholesalePrice, offMrpPct } from "@/lib/pricing";
import {
  updateProductDetails,
  deleteProduct,
  searchCompetitorAction,
  saveCompetitorMap,
  removeCompetitorMap,
  updateMapCondition,
  acceptSuggestion,
} from "@/lib/admin/actions";

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
  fetched_at: string;
} | null;

export type MapCell = { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null; item_condition: string | null; competitor_brand_sku: string | null } | null;

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
  const [openId, setOpenId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat !== "All" && r.category !== cat) return false;
      if (needle && !`${r.name} ${r.sku} ${r.brand}`.toLowerCase().includes(needle)) return false;
      const n = mappedCount(r);
      if (view === "mapped" && n === 0) return false;
      if (view === "unmapped" && n !== 0) return false;
      if (view === "multi" && n < 2) return false;
      if (sellersN !== "any" && n !== sellersN) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, cat, view, sellersN, sources]);

  // A product has a live suggestion when any source's price differs from ₹1-under.
  const hasSuggestion = (r: ManagerRow) =>
    sources.some((s) => {
      const p = r.perSource[s.id]?.price;
      return p && p.status === "pending" && p.suggested_price != null && Math.round(r.elume_price) !== p.suggested_price;
    });

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
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{filtered.length} shown</span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        {filtered.map((r, i) => {
          const open = openId === r.id;
          const sug = hasSuggestion(r);
          const n = mappedCount(r);
          return (
            <div key={r.id} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              {/* Summary row */}
              <div onClick={() => setOpenId(open ? null : r.id)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 16px", cursor: "pointer", background: open ? "#FAFBFE" : undefined }}>
                <span style={{ color: "#8A93A6", fontSize: 12, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", width: 12 }}>▶</span>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, display: "flex", alignItems: "center", gap: 7 }}>
                    {r.name}
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
                {sug && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "2px 9px", whiteSpace: "nowrap" }}>price suggestion</span>}
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

  const del = () => start(async () => { const fd = new FormData(); fd.set("id", row.id); await deleteProduct(fd); });

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
        <Field label="MRP (₹)"><input type="number" step="any" value={f.mrp} onChange={set("mrp")} style={inp} /></Field>
        <Field label="Elume price (₹)"><input type="number" step="any" value={f.elume_price} onChange={set("elume_price")} style={{ ...inp, fontWeight: 700, borderColor: "#C9CFF6" }} /></Field>
        <div style={{ alignSelf: "end", fontSize: 12, color: "#56627A", paddingBottom: 8 }}>
          {valid ? <>{offMrpPct(elume, mrp)}% off · wholesale {fmt(wholesalePrice(elume))}</> : "—"}
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

  // Comparable prices across sellers → flag the cheapest.
  const comparables = mappedSellers
    .map((s) => row.perSource[s.id].price?.comparable_price)
    .filter((v): v is number => v != null && v > 0);
  const lowest = comparables.length ? Math.min(...comparables) : null;

  const setCondition = (source: string, condition: string) =>
    start(async () => { const res = await updateMapCondition(row.id, source, condition); if (res.ok) router.refresh(); else setMsg({ ok: false, t: res.error ?? "Failed." }); });
  const unmap = (source: string) => start(async () => { await removeCompetitorMap(row.id, source); router.refresh(); });
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
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 0.9fr 1fr auto", gap: 10, padding: "9px 14px", background: "#F7F8FB", borderBottom: "1px solid #EEF0F4", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "#8A93A6" }}>
            <span>Seller</span><span>Competitor price</span><span>Condition</span><span>Link</span><span />
          </div>
          {mappedSellers.map((s, i) => {
            const cell = row.perSource[s.id];
            const p = cell.price;
            const map = cell.map!;
            const comparable = p?.comparable_price ?? null;
            const isCheapest = comparable != null && lowest != null && comparable === lowest && mappedSellers.length > 1;
            const url = map.competitor_url ?? p?.competitor_url ?? null;
            const canReprice = p?.suggested_price != null && p.suggested_price !== Math.round(row.elume_price);
            return (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 1.3fr 0.9fr 1fr auto", gap: 10, padding: "11px 14px", borderTop: i ? "1px solid #F5F6F9" : undefined, alignItems: "center" }}>
                {/* Seller */}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {s.name}
                    {isCheapest && <span style={{ fontSize: 9, fontWeight: 700, color: "#137a4b", background: "#E6F5EE", padding: "1px 6px", borderRadius: 6 }}>LOWEST</span>}
                  </div>
                  <div style={{ fontFamily: "var(--space-mono)", fontSize: 10.5, color: "#8A93A6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={map.competitor_code}>{map.competitor_code}</div>
                </div>
                {/* Price */}
                <div>
                  {comparable != null ? (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(comparable)}</div>
                      <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>
                        {p?.net_price != null ? `net ${fmt(p.net_price)}` : p?.list_price != null ? `list ${fmt(p.list_price)}` : ""}{(map.unit_factor ?? 1) !== 1 ? ` ·×${map.unit_factor}` : ""}
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: 12, color: "#C77700" }}>awaiting sync</span>
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
                  {canReprice && (
                    <button onClick={() => accept(s.id, p!.suggested_price!)} disabled={busy} title="Set our price to ₹1 under this seller" style={{ ...primary, fontSize: 11.5, padding: "6px 11px" }}>→ {fmt(p!.suggested_price!)}</button>
                  )}
                  <button onClick={() => unmap(s.id)} disabled={busy} aria-label={`Remove ${s.name}`} title="Remove this seller" style={{ background: "none", border: "none", color: "#C4C9D4", fontSize: 16, cursor: "pointer", lineHeight: 1 }}>✕</button>
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
