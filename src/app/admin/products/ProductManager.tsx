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

export type ManagerRow = {
  id: string;
  name: string;
  sku: string;
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
  perSource: Record<string, { map: { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null } | null; price: PriceCell }>;
};

type Hit = { code: string; name: string; brand: string | null; listPrice: number | null; netPrice: number | null; url: string | null };

export default function ProductManager({ rows, sources }: { rows: ManagerRow[]; sources: SourceInfo[] }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [openId, setOpenId] = useState<string | null>(null);

  const cats = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()], [rows]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (cat === "All" || r.category === cat) && (!needle || `${r.name} ${r.sku} ${r.brand}`.toLowerCase().includes(needle)));
  }, [rows, q, cat]);

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
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{filtered.length} shown</span>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        {filtered.map((r, i) => {
          const open = openId === r.id;
          const sug = hasSuggestion(r);
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
    name: row.name, spec: row.spec ?? "", unit: row.unit,
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
        id: row.id, name: f.name, spec: f.spec, unit: f.unit, mrp, elume_price: elume,
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
      <Field label="Spec"><input value={f.spec} onChange={set("spec")} style={inp} /></Field>
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

/* ── Tab 2: Competitor pricing ── */
function CompetitorTab({ row, sources }: { row: ManagerRow; sources: SourceInfo[] }) {
  const router = useRouter();
  const [source, setSource] = useState(sources.find((s) => s.enabled)?.id ?? sources[0]?.id ?? "vashi");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const active = sources.find((s) => s.id === source);
  const cell = row.perSource[source] ?? { map: null, price: null };
  const p = cell.price;

  const accept = () => start(async () => {
    const res = await acceptSuggestion(row.id, source);
    setMsg(res.ok ? { ok: true, t: `Elume price set to ${fmt(p!.suggested_price ?? 0)}.` } : { ok: false, t: res.error ?? "Failed." });
    if (res.ok) router.refresh();
  });
  const unmap = () => start(async () => { await removeCompetitorMap(row.id, source); router.refresh(); });

  return (
    <div>
      {/* Source sub-tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {sources.map((s) => (
          <button key={s.id} onClick={() => s.enabled && setSource(s.id)} disabled={!s.enabled} style={{ fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 9, cursor: s.enabled ? "pointer" : "default", background: s.id === source ? "#161D2B" : "#fff", color: s.id === source ? "#fff" : s.enabled ? "#3A4358" : "#B4BAC6", border: "1px solid #E0E4ED" }}>
            {s.name}{!s.enabled && <span style={{ fontSize: 9.5, marginLeft: 5 }}>soon</span>}
          </button>
        ))}
      </div>

      {cell.map ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: p ? 12 : 0 }}>
            <div style={{ fontSize: 12.5, color: "#56627A" }}>
              Mapped to <span style={{ fontFamily: "var(--space-mono)", background: "#F0F2F6", padding: "2px 7px", borderRadius: 6 }}>{cell.map.competitor_code}</span> ×{cell.map.unit_factor}
              {cell.map.competitor_url && <> · <a href={cell.map.competitor_url} target="_blank" rel="noreferrer" style={{ color: "#4E5BDC" }}>view on {active?.name}</a></>}
            </div>
            <button onClick={unmap} disabled={busy} style={{ ...ghost, fontSize: 12, color: "#C0392B" }}>Remove mapping</button>
          </div>

          {p ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, alignItems: "end" }}>
                <Metric label="Our price" value={fmt(row.elume_price)} big color="#4E5BDC" />
                <Metric label={`${active?.name} list`} value={p.list_price != null ? fmt(p.list_price) : "—"} strike />
                <Metric label={`${active?.name} net (incl GST)`} value={p.net_price != null ? fmt(p.net_price) : (p.list_price != null ? fmt(p.list_price) : "—")} sub={`×${p.unit_factor ?? 1} = ${fmt(p.comparable_price ?? 0)}`} />
                <Metric label="Suggested (−₹1)" value={fmt(p.suggested_price ?? 0)} big color={p.suggested_price != null && p.suggested_price < Math.round(row.elume_price) ? "#137a4b" : "#C0392B"} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: "#56627A" }}>
                  {p.comparable_price != null && (p.comparable_price > row.elume_price
                    ? <>You&apos;re <b style={{ color: "#137a4b" }}>{fmt(p.comparable_price - row.elume_price)} cheaper</b> than {active?.name}.</>
                    : <>You&apos;re <b style={{ color: "#C0392B" }}>{fmt(row.elume_price - p.comparable_price)} pricier</b> than {active?.name}.</>)}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                  {msg && <span style={{ fontSize: 12.5, fontWeight: 600, color: msg.ok ? "#137a4b" : "#C0392B" }}>{msg.t}</span>}
                  <button onClick={accept} disabled={busy || p.suggested_price == null} style={{ ...primary, opacity: busy || p.suggested_price == null ? 0.6 : 1 }}>
                    Set Elume price to {fmt(p.suggested_price ?? 0)}
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 8 }}>Last checked {new Date(p.fetched_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · comparable = {active?.name} net × unit factor</div>
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 10 }}>Mapped, but not synced yet. Run a sync from <a href="/admin/radar" style={{ color: "#4E5BDC" }}>All suggestions</a>.</div>
          )}
        </div>
      ) : (
        <MatchPicker row={row} source={source} sourceName={active?.name ?? source} onDone={() => router.refresh()} />
      )}
    </div>
  );
}

function MatchPicker({ row, source, sourceName, onDone }: { row: ManagerRow; source: string; sourceName: string; onDone: () => void }) {
  const [query, setQuery] = useState(`${row.brand} ${row.name}`.replace(/—.*/, "").trim());
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [chosen, setChosen] = useState<Hit | null>(null);
  const [factor, setFactor] = useState(String(row.suggestedFactor));
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const search = () => start(async () => { setErr(null); setHits((await searchCompetitorAction(source, query)) as Hit[]); });
  const save = () => start(async () => {
    if (!chosen) { setErr("Pick a product first."); return; }
    const res = await saveCompetitorMap({ product_id: row.id, source, competitor_code: chosen.code, competitor_url: chosen.url, unit_factor: Number(factor) });
    if (res.ok) onDone(); else setErr(res.error ?? "Failed.");
  });
  const chosenPrice = chosen ? (chosen.netPrice ?? chosen.listPrice) : null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, color: "#56627A", marginBottom: 10 }}>Not mapped to {sourceName} yet — find the matching product:</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={`Search ${sourceName}…`} style={{ ...inp, flex: 1 }} />
        <button onClick={search} disabled={busy} style={ghost}>{busy && !hits ? "Searching…" : "Search"}</button>
      </div>
      {hits && (
        <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #E8EBF1", borderRadius: 9, marginBottom: 10 }}>
          {hits.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#8A93A6" }}>No results — try a shorter query.</div>}
          {hits.map((h) => {
            const price = h.netPrice ?? h.listPrice;
            return (
              <button key={h.code} onClick={() => setChosen(h)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 10, alignItems: "center", padding: "9px 11px", border: "none", borderTop: "1px solid #F5F6F9", background: chosen?.code === h.code ? "#EEF0FE" : "#fff", cursor: "pointer" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: "#8A93A6", fontFamily: "var(--space-mono)" }}>{h.brand} · {h.code}</span>
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{price != null ? fmt(price) : "—"}<span style={{ fontSize: 10, color: "#8A93A6" }}>/u</span></span>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Unit factor (× their price)"><input type="number" step="any" value={factor} onChange={(e) => setFactor(e.target.value)} style={{ ...inp, width: 130 }} /></Field>
        <div style={{ fontSize: 11.5, color: "#8A93A6", flex: 1, minWidth: 150, paddingBottom: 8 }}>
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
function Metric({ label, value, sub, big, strike, color }: { label: string; value: string; sub?: string; big?: boolean; strike?: boolean; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
      <div style={{ fontSize: big ? 18 : 15, fontWeight: 700, color: color ?? "#19202e", textDecoration: strike ? "line-through" : undefined, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>{sub}</div>}
    </div>
  );
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
