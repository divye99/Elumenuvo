"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import {
  searchCompetitorAction,
  saveCompetitorMap,
  removeCompetitorMap,
  acceptSuggestion,
  dismissSuggestion,
  syncCompetitorNow,
} from "@/lib/admin/actions";

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

export type RadarRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  ourPrice: number;
  suggestedFactor: number;
  perSource: Record<string, { map: { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null } | null; price: PriceCell }>;
};

type Hit = { code: string; name: string; brand: string | null; listPrice: number | null; netPrice: number | null; url: string | null };

const actionable = (r: RadarRow, src: string) => {
  const p = r.perSource[src]?.price;
  return !!p && p.status === "pending" && p.suggested_price != null && Math.round(r.ourPrice) !== p.suggested_price;
};

export default function RadarClient({
  rows,
  sources,
  lastSync,
}: {
  rows: RadarRow[];
  sources: SourceInfo[];
  lastSync: { created_at: string; mapped: number; fetched: number; failed: number; suggestions: number; run_source: string; source: string } | null;
}) {
  const router = useRouter();
  const [source, setSource] = useState(sources.find((s) => s.enabled)?.id ?? sources[0]?.id ?? "vashi");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const active = sources.find((s) => s.id === source);
  const suggestions = useMemo(() => rows.filter((r) => actionable(r, source)), [rows, source]);
  const mappedCount = rows.filter((r) => r.perSource[source]?.map).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => !needle || `${r.name} ${r.brand} ${r.category} ${r.id}`.toLowerCase().includes(needle));
  }, [rows, q]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      setFlash(res.ok ? { ok: true, msg: okMsg } : { ok: false, msg: res.error ?? "Failed." });
      if (res.ok) router.refresh();
    });

  const sync = () =>
    startTransition(async () => {
      setFlash({ ok: true, msg: `Syncing from ${active?.name}… this can take a minute.` });
      const res = await syncCompetitorNow(source);
      if (res.ok && res.result) {
        setFlash({ ok: true, msg: `Synced ${res.result.fetched}/${res.result.mapped} · ${res.result.suggestions} suggestion${res.result.suggestions === 1 ? "" : "s"}${res.result.failed ? ` · ${res.result.failed} failed` : ""}.` });
        router.refresh();
      } else setFlash({ ok: false, msg: !res.ok && res.error ? res.error : "Sync failed." });
    });

  return (
    <div>
      {/* Source tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {sources.map((s) => {
          const on = s.id === source;
          return (
            <button
              key={s.id}
              onClick={() => s.enabled && setSource(s.id)}
              disabled={!s.enabled}
              style={{
                fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 10, cursor: s.enabled ? "pointer" : "default",
                background: on ? "#161D2B" : "#fff", color: on ? "#fff" : s.enabled ? "#3A4358" : "#B4BAC6",
                border: `1px solid ${on ? "#161D2B" : "#E0E4ED"}`,
              }}
            >
              {s.name}{!s.enabled && <span style={{ fontSize: 10.5, marginLeft: 6, opacity: 0.8 }}>soon</span>}
            </button>
          );
        })}
      </div>

      {/* Sync bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: "#56627A" }}>
          {lastSync ? <>Last sync <b>{new Date(lastSync.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {lastSync.fetched}/{lastSync.mapped} · {lastSync.run_source}</> : <>Not synced yet · {mappedCount} mapped on {active?.name}</>}
          {active?.needsLogin && <span style={{ marginLeft: 8, fontSize: 11.5, color: "#8A93A6" }}>· net price needs a {active.name} login secret</span>}
        </div>
        <button onClick={sync} disabled={pending || mappedCount === 0} style={{ background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", padding: "9px 16px", borderRadius: 9, cursor: pending || mappedCount === 0 ? "default" : "pointer", opacity: pending || mappedCount === 0 ? 0.6 : 1 }}>
          {pending ? "Working…" : "↻ Sync now"}
        </button>
      </div>

      {flash && <div style={{ background: flash.ok ? "#E6F5EE" : "#FBE9E4", color: flash.ok ? "#137a4b" : "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{flash.msg}</div>}

      {/* Suggestions */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 10px" }}>
        Price suggestions {suggestions.length > 0 && <span style={{ fontSize: 12.5, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "1px 9px", marginLeft: 6 }}>{suggestions.length}</span>}
      </h2>
      {suggestions.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8A93A6", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
          No open suggestions on {active?.name}. Map products below and run a sync.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
          {suggestions.map((r, i) => {
            const p = r.perSource[source].price!;
            const cheaper = p.suggested_price! < Math.round(r.ourPrice);
            return (
              <div key={r.id} style={{ padding: "14px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#8A93A6" }}>
                    {r.brand} · {p.competitor_url ? <a href={p.competitor_url} target="_blank" rel="noreferrer" style={{ color: "#4E5BDC" }}>{p.competitor_name?.slice(0, 44)}</a> : p.competitor_name?.slice(0, 44)}
                    {p.net_price == null && active?.needsLogin && <span style={{ color: "#C5841C" }}> · list price only</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12.5 }}>
                  <Stat label="Our price" value={fmt(r.ourPrice)} />
                  <Stat label={`${active?.name} (comparable)`} value={fmt(p.comparable_price ?? 0)} sub={`${p.net_price != null ? "net" : "list"} ₹${p.net_price ?? p.list_price}/u ×${p.unit_factor ?? 1}`} />
                  <Stat label="Suggested (−₹1)" value={fmt(p.suggested_price ?? 0)} color={cheaper ? "#137a4b" : "#C0392B"} />
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button onClick={() => run(() => acceptSuggestion(r.id, source), `Updated ${r.name} to ${fmt(p.suggested_price ?? 0)}.`)} disabled={pending} style={btnAccept}>Accept</button>
                  <button onClick={() => run(() => dismissSuggestion(r.id, source), "Dismissed.")} disabled={pending} style={btnGhost}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mapping */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Product mapping <span style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 400 }}>({mappedCount}/{rows.length} on {active?.name})</span></h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "8px 12px", fontSize: 13, minWidth: 220 }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", maxHeight: "60vh", overflowY: "auto" }}>
        {filtered.map((r, i) => {
          const cell = r.perSource[source] ?? { map: null, price: null };
          return (
            <div key={r.id} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              <div style={{ padding: "11px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                  <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{r.brand} · {fmt(r.ourPrice)}/{r.unit}</div>
                </div>
                {cell.map ? (
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "#3A4358" }}>
                      <span style={{ fontFamily: "var(--space-mono)", background: "#F0F2F6", padding: "2px 7px", borderRadius: 6 }}>{cell.map.competitor_code}</span> ×{cell.map.unit_factor}
                      {cell.price?.net_price != null && <span style={{ color: "#137a4b" }}> · net ₹{cell.price.net_price}</span>}
                      {cell.price?.net_price == null && cell.price?.list_price != null && <span style={{ color: "#8A93A6" }}> · list ₹{cell.price.list_price}</span>}
                      {cell.price?.status === "accepted" && <span style={{ color: "#137a4b", marginLeft: 6 }}>✓</span>}
                    </span>
                    <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={linkBtn}>Edit</button>
                    <button onClick={() => run(() => removeCompetitorMap(r.id, source), "Mapping removed.")} disabled={pending} style={{ ...linkBtn, color: "#C0392B" }}>Remove</button>
                  </div>
                ) : (
                  <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={{ ...btnGhost, fontSize: 12.5 }}>+ Map to {active?.name}</button>
                )}
              </div>
              {pickerFor === r.id && (
                <MatchPicker row={r} source={source} sourceName={active?.name ?? source} onDone={(msg) => { setPickerFor(null); setFlash({ ok: true, msg }); router.refresh(); }} onCancel={() => setPickerFor(null)} />
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div style={{ padding: 20, fontSize: 13, color: "#8A93A6", textAlign: "center" }}>No matching products.</div>}
      </div>
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
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder={`Search ${sourceName} (brand + spec)…`} style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 11px", fontSize: 13 }} />
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
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#19202e" }}>{price != null ? fmt(price) : "—"}<span style={{ fontSize: 10, color: "#8A93A6" }}>/u</span></span>
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
          {chosen && chosenPrice != null ? <>Comparable ≈ <b>{fmt(chosenPrice * (Number(factor) || 1))}</b> vs our {fmt(row.ourPrice)}</> : "Wire is priced per metre — a 90 m coil uses ×90."}
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

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10.5, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.3px" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? "#19202e", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#A0A7B5" }}>{sub}</div>}
    </div>
  );
}

const btnAccept: React.CSSProperties = { background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 12.5, border: "none", padding: "8px 15px", borderRadius: 9, cursor: "pointer" };
const btnGhost: React.CSSProperties = { background: "#fff", color: "#19202e", fontWeight: 600, fontSize: 13, border: "1px solid #E0E4ED", padding: "8px 14px", borderRadius: 9, cursor: "pointer" };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "#4E5BDC", fontWeight: 600, fontSize: 12.5, cursor: "pointer" };
