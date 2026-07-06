"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import {
  searchVashiAction,
  saveCompetitorMap,
  removeCompetitorMap,
  acceptSuggestion,
  dismissSuggestion,
  syncCompetitorNow,
} from "@/lib/admin/actions";

export type RadarRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  ourPrice: number;
  suggestedFactor: number;
  map: { vashi_code: string; unit_factor: number; note: string | null } | null;
  price: {
    vashi_name: string | null;
    vashi_url: string | null;
    vashi_price: number | null;
    unit_factor: number | null;
    comparable_price: number | null;
    suggested_price: number | null;
    our_price: number | null;
    status: string;
    in_stock: boolean | null;
    fetched_at: string;
  } | null;
};

type VashiHit = { code: string; name: string; brand: string | null; price: number | null; url: string | null };

const actionable = (r: RadarRow) =>
  !!r.price && r.price.status === "pending" && r.price.suggested_price != null && Math.round(r.ourPrice) !== r.price.suggested_price;

export default function RadarClient({
  rows,
  lastSync,
}: {
  rows: RadarRow[];
  lastSync: { created_at: string; mapped: number; fetched: number; failed: number; suggestions: number; source: string } | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const suggestions = useMemo(() => rows.filter(actionable), [rows]);
  const mappedCount = rows.filter((r) => r.map).length;

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
      setFlash({ ok: true, msg: "Syncing prices from Vashi… (this can take a minute)" });
      const res = await syncCompetitorNow();
      if (res.ok && res.result) {
        setFlash({ ok: true, msg: `Synced ${res.result.fetched}/${res.result.mapped} · ${res.result.suggestions} new suggestion${res.result.suggestions === 1 ? "" : "s"}${res.result.failed ? ` · ${res.result.failed} failed` : ""}.` });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: !res.ok && res.error ? res.error : "Sync failed." });
      }
    });

  return (
    <div>
      {/* Sync bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: "#56627A" }}>
          {lastSync ? (
            <>Last sync <b>{new Date(lastSync.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {lastSync.fetched}/{lastSync.mapped} fetched{lastSync.failed ? ` · ${lastSync.failed} failed` : ""} · {lastSync.source}</>
          ) : (
            <>Not synced yet · {mappedCount} product{mappedCount === 1 ? "" : "s"} mapped</>
          )}
        </div>
        <button onClick={sync} disabled={pending || mappedCount === 0} style={{ background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", padding: "9px 16px", borderRadius: 9, cursor: pending || mappedCount === 0 ? "default" : "pointer", opacity: pending || mappedCount === 0 ? 0.6 : 1 }}>
          {pending ? "Working…" : "↻ Sync now"}
        </button>
      </div>

      {flash && (
        <div style={{ background: flash.ok ? "#E6F5EE" : "#FBE9E4", color: flash.ok ? "#137a4b" : "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{flash.msg}</div>
      )}

      {/* Suggestions */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "8px 0 10px" }}>
        Price suggestions {suggestions.length > 0 && <span style={{ fontSize: 12.5, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "1px 9px", marginLeft: 6 }}>{suggestions.length}</span>}
      </h2>
      {suggestions.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8A93A6", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
          No open suggestions. Map products below and run a sync — anything where Vashi&apos;s price differs from your ₹1-under target will appear here.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", marginBottom: 22 }}>
          {suggestions.map((r, i) => {
            const cheaper = r.price!.suggested_price! < Math.round(r.ourPrice);
            return (
              <div key={r.id} style={{ padding: "14px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#8A93A6" }}>
                    {r.brand} · Vashi: {r.price!.vashi_url ? <a href={r.price!.vashi_url} target="_blank" rel="noreferrer" style={{ color: "#4E5BDC" }}>{r.price!.vashi_name?.slice(0, 46)}</a> : r.price!.vashi_name?.slice(0, 46)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18, alignItems: "center", fontSize: 12.5 }}>
                  <Stat label="Our price" value={fmt(r.ourPrice)} />
                  <Stat label="Vashi (comparable)" value={fmt(r.price!.comparable_price ?? 0)} sub={`₹${r.price!.vashi_price}/u ×${r.price!.unit_factor ?? 1}`} />
                  <Stat label="Suggested (−₹1)" value={fmt(r.price!.suggested_price ?? 0)} color={cheaper ? "#137a4b" : "#C0392B"} />
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button onClick={() => run(() => acceptSuggestion(r.id), `Updated ${r.name} to ${fmt(r.price!.suggested_price ?? 0)}.`)} disabled={pending} style={btnAccept}>Accept</button>
                  <button onClick={() => run(() => dismissSuggestion(r.id), "Dismissed.")} disabled={pending} style={btnGhost}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Mapping */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Product mapping <span style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 400 }}>({mappedCount}/{rows.length} mapped)</span></h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "8px 12px", fontSize: 13, minWidth: 220 }} />
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", maxHeight: "60vh", overflowY: "auto" }}>
        {filtered.map((r, i) => (
          <div key={r.id} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined }}>
            <div style={{ padding: "11px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{r.brand} · {fmt(r.ourPrice)}/{r.unit}</div>
              </div>
              {r.map ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "#3A4358" }}>
                    <span style={{ fontFamily: "var(--space-mono)", background: "#F0F2F6", padding: "2px 7px", borderRadius: 6 }}>{r.map.vashi_code}</span> ×{r.map.unit_factor}
                    {r.price?.vashi_price != null && <span style={{ color: "#8A93A6" }}> · ₹{r.price.vashi_price}/u</span>}
                    {r.price?.status === "accepted" && <span style={{ color: "#137a4b", marginLeft: 6 }}>✓ accepted</span>}
                    {r.price?.status === "dismissed" && <span style={{ color: "#8A93A6", marginLeft: 6 }}>dismissed</span>}
                  </span>
                  <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={linkBtn}>Edit</button>
                  <button onClick={() => run(() => removeCompetitorMap(r.id), "Mapping removed.")} disabled={pending} style={{ ...linkBtn, color: "#C0392B" }}>Remove</button>
                </div>
              ) : (
                <button onClick={() => setPickerFor(pickerFor === r.id ? null : r.id)} style={{ ...btnGhost, fontSize: 12.5 }}>+ Map to Vashi</button>
              )}
            </div>
            {pickerFor === r.id && (
              <MatchPicker row={r} onDone={(msg) => { setPickerFor(null); setFlash({ ok: true, msg }); router.refresh(); }} onCancel={() => setPickerFor(null)} />
            )}
          </div>
        ))}
        {filtered.length === 0 && <div style={{ padding: 20, fontSize: 13, color: "#8A93A6", textAlign: "center" }}>No matching products.</div>}
      </div>
    </div>
  );
}

function MatchPicker({ row, onDone, onCancel }: { row: RadarRow; onDone: (msg: string) => void; onCancel: () => void }) {
  const [query, setQuery] = useState(`${row.brand} ${row.name}`.replace(/—.*/, "").trim());
  const [hits, setHits] = useState<VashiHit[] | null>(null);
  const [chosen, setChosen] = useState<VashiHit | null>(row.map ? { code: row.map.vashi_code, name: row.price?.vashi_name ?? row.map.vashi_code, brand: row.brand, price: row.price?.vashi_price ?? null, url: row.price?.vashi_url ?? null } : null);
  const [factor, setFactor] = useState(String(row.map?.unit_factor ?? row.suggestedFactor));
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const search = () =>
    startTransition(async () => {
      setErr(null);
      const res = await searchVashiAction(query);
      setHits(res as VashiHit[]);
    });

  const save = () =>
    startTransition(async () => {
      if (!chosen) { setErr("Pick a Vashi product first."); return; }
      const res = await saveCompetitorMap({ product_id: row.id, vashi_code: chosen.code, unit_factor: Number(factor) });
      if (res.ok) onDone(`Mapped ${row.name} → ${chosen.code}. Run a sync to fetch its price.`);
      else setErr(res.error ?? "Failed to save.");
    });

  return (
    <div style={{ background: "#F7F8FB", borderTop: "1px solid #EEF0F4", padding: "14px 16px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} placeholder="Search Vashi (brand + spec)…" style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 11px", fontSize: 13 }} />
        <button onClick={search} disabled={busy} style={{ ...btnGhost, fontSize: 12.5 }}>{busy && !hits ? "Searching…" : "Search"}</button>
      </div>

      {hits && (
        <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #E8EBF1", borderRadius: 9, background: "#fff", marginBottom: 10 }}>
          {hits.length === 0 && <div style={{ padding: 12, fontSize: 12.5, color: "#8A93A6" }}>No results — try a shorter query.</div>}
          {hits.map((h) => (
            <button key={h.code} onClick={() => setChosen(h)} style={{ display: "flex", width: "100%", textAlign: "left", gap: 10, alignItems: "center", padding: "9px 11px", border: "none", borderTop: "1px solid #F5F6F9", background: chosen?.code === h.code ? "#EEF0FE" : "transparent", cursor: "pointer" }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202e", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                <span style={{ fontSize: 11, color: "#8A93A6", fontFamily: "var(--space-mono)" }}>{h.brand} · {h.code}</span>
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#19202e" }}>{h.price != null ? fmt(h.price) : "—"}<span style={{ fontSize: 10, color: "#8A93A6" }}>/u</span></span>
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>Unit factor (× Vashi price)</label>
          <input value={factor} onChange={(e) => setFactor(e.target.value)} type="number" step="any" style={{ width: 120, border: "1px solid #E0E4ED", borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
        </div>
        <div style={{ fontSize: 11.5, color: "#8A93A6", flex: 1, minWidth: 160, paddingBottom: 8 }}>
          {chosen && chosen.price != null ? <>Comparable ≈ <b>{fmt(chosen.price * (Number(factor) || 1))}</b> vs our {fmt(row.ourPrice)}</> : "Vashi prices wire per metre — a 90 m coil uses ×90."}
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
