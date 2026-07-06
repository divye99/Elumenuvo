"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import {
  searchCompetitorAction,
  saveCompetitorMap,
  removeCompetitorMap,
  dismissSuggestion,
  syncCompetitorNow,
  applyRecommendedPrice,
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

export type Rec = { basisPrice: number; target: number; changePct: number; blocked: string | null; basis: string } | null;

export type RadarRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  ourPrice: number;
  mrp: number;
  suggestedFactor: number;
  perSource: Record<string, { map: { competitor_code: string; competitor_url: string | null; unit_factor: number; note: string | null } | null; price: PriceCell }>;
  rec: Rec;
};

type Hit = { code: string; name: string; brand: string | null; listPrice: number | null; netPrice: number | null; url: string | null };

/** A product can be actioned when it has a recommendation that isn't blocked
 *  and differs from the current price. */
const isApplyable = (r: RadarRow) => !!r.rec && !r.rec.blocked && r.rec.target !== Math.round(r.ourPrice);

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
  const [source, setSource] = useState(sources.find((s) => s.enabled)?.id ?? sources[0]?.id ?? "vashi");
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);

  const active = sources.find((s) => s.id === source);
  const recommendations = useMemo(() => rows.filter(isApplyable), [rows]);
  const blocked = useMemo(() => rows.filter((r) => r.rec?.blocked), [rows]);
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
      {/* Portfolio dashboard */}
      <PortfolioSummary rows={rows} recommendations={recommendations} blocked={blocked} lastSync={lastSync} />

      {/* Repricing rules */}
      <RulesPanel rules={rules} categories={categories} onSaved={(m) => { setFlash({ ok: true, msg: m }); router.refresh(); }} />

      {flash && <div style={{ background: flash.ok ? "#E6F5EE" : "#FBE9E4", color: flash.ok ? "#137a4b" : "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, margin: "14px 0" }}>{flash.msg}</div>}

      {/* Recommendations (rule-based, product-level, guardrailed) */}
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: "18px 0 10px" }}>
        Repricing recommendations {recommendations.length > 0 && <span style={{ fontSize: 12.5, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "1px 9px", marginLeft: 6 }}>{recommendations.length}</span>}
      </h2>
      {recommendations.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8A93A6", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "16px 18px", marginBottom: 22 }}>
          No open recommendations. Map products below and run a sync — anything the rule would reprice appears here.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          {recommendations.map((r, i) => {
            const rec = r.rec!;
            const cheaper = rec.target < Math.round(r.ourPrice);
            return (
              <div key={r.id} style={{ padding: "14px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "#8A93A6" }}>{r.brand} · {r.category}</div>
                </div>
                <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12.5 }}>
                  <Stat label="Our price" value={fmt(r.ourPrice)} />
                  <Stat label={rec.basis === "cheapest" ? "Cheapest" : "Market avg"} value={fmt(rec.basisPrice)} />
                  <Stat label="Recommended" value={fmt(rec.target)} color={cheaper ? "#137a4b" : "#C0392B"} sub={`${cheaper ? "−" : "+"}${rec.changePct}%`} />
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  <button onClick={() => run(() => applyRecommendedPrice(r.id, rec.target), `${r.name} set to ${fmt(rec.target)}.`)} disabled={pending} style={btnAccept}>Set {fmt(rec.target)}</button>
                  <button onClick={() => run(() => dismissSuggestion(r.id, source), "Dismissed.")} disabled={pending} style={btnGhost}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guardrail-blocked (e.g. mismatched mapping → above-MRP price) */}
      {blocked.length > 0 && (
        <details style={{ marginBottom: 22 }}>
          <summary style={{ fontSize: 13, fontWeight: 600, color: "#9a3b16", cursor: "pointer", padding: "4px 0" }}>
            ⚠ {blocked.length} recommendation{blocked.length === 1 ? "" : "s"} blocked by guardrails (likely a mismatched mapping)
          </summary>
          <div style={{ background: "#FDF6F2", border: "1px solid #f0d9cd", borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
            {blocked.map((r, i) => (
              <div key={r.id} style={{ padding: "10px 14px", borderTop: i ? "1px solid #f0d9cd" : undefined, display: "flex", gap: 12, alignItems: "center", fontSize: 12.5, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 220px", fontWeight: 600 }}>{r.name}</span>
                <span style={{ color: "#8A93A6" }}>our {fmt(r.ourPrice)} · {r.rec!.basis === "cheapest" ? "cheapest" : "market"} {fmt(r.rec!.basisPrice)} → {fmt(r.rec!.target)}</span>
                <span style={{ fontWeight: 700, color: "#9a3b16" }}>blocked: {r.rec!.blocked}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Source tabs + sync (per-source mapping controls) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {sources.map((s) => {
          const on = s.id === source;
          return (
            <button key={s.id} onClick={() => s.enabled && setSource(s.id)} disabled={!s.enabled} style={{ fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: 10, cursor: s.enabled ? "pointer" : "default", background: on ? "#161D2B" : "#fff", color: on ? "#fff" : s.enabled ? "#3A4358" : "#B4BAC6", border: `1px solid ${on ? "#161D2B" : "#E0E4ED"}` }}>
              {s.name}{!s.enabled && <span style={{ fontSize: 10.5, marginLeft: 6, opacity: 0.8 }}>soon</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: "#56627A" }}>
          {lastSync ? <>Last sync <b>{new Date(lastSync.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</b> · {lastSync.fetched}/{lastSync.mapped} · {lastSync.run_source}</> : <>Not synced yet · {mappedCount} mapped on {active?.name}</>}
        </div>
        <button onClick={sync} disabled={pending || mappedCount === 0} style={{ background: "#161D2B", color: "#fff", fontWeight: 600, fontSize: 13, border: "none", padding: "9px 16px", borderRadius: 9, cursor: pending || mappedCount === 0 ? "default" : "pointer", opacity: pending || mappedCount === 0 ? 0.6 : 1 }}>
          {pending ? "Working…" : "↻ Sync now"}
        </button>
      </div>

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

/* ── Portfolio dashboard ── */
function PortfolioSummary({ rows, recommendations, blocked, lastSync }: { rows: RadarRow[]; recommendations: RadarRow[]; blocked: RadarRow[]; lastSync: { created_at: string } | null }) {
  const priced = rows.filter((r) => r.rec); // has a comparable → a market position
  const below = priced.filter((r) => r.ourPrice < r.rec!.basisPrice).length; // we're cheaper than market
  const above = priced.filter((r) => r.ourPrice > r.rec!.basisPrice).length;
  const posPct = priced.length
    ? Math.round((priced.reduce((s, r) => s + (r.ourPrice - r.rec!.basisPrice) / r.rec!.basisPrice, 0) / priced.length) * 100)
    : null;

  const tile = (label: string, value: string | number, sub?: string, color?: string) => (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: "var(--space-grotesk)", fontSize: 24, fontWeight: 700, color: color ?? "#19202e", marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {tile("Tracked", `${priced.length}/${rows.length}`, "products with market data")}
        {tile("Below market", below, priced.length ? `${Math.round((below / priced.length) * 100)}% of tracked` : undefined, "#137a4b")}
        {tile("Above market", above, priced.length ? `${Math.round((above / priced.length) * 100)}% of tracked` : undefined, above ? "#C0392B" : "#19202e")}
        {tile("Recommendations", recommendations.length, "ready to apply", recommendations.length ? "#E0612A" : "#19202e")}
        {tile("Avg vs market", posPct == null ? "—" : `${posPct > 0 ? "+" : ""}${posPct}%`, posPct == null ? undefined : posPct <= 0 ? "we're cheaper" : "we're pricier", posPct != null && posPct <= 0 ? "#137a4b" : "#C0392B")}
        {blocked.length > 0 && tile("Guardrail blocks", blocked.length, "check mappings", "#9a3b16")}
      </div>
      {lastSync && <div style={{ fontSize: 11.5, color: "#A0A7B5", marginTop: 8 }}>Prices last refreshed {new Date(lastSync.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</div>}
    </div>
  );
}

/* ── Repricing rules ── */
function RulesPanel({ rules, categories, onSaved }: { rules: RepricingRule[]; categories: string[]; onSaved: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const global = rules.find((r) => r.scope === "global") ?? { scope: "global", basis: "market_avg" as const, delta: 1, delta_type: "rupees" as const, max_change_pct: 40, never_above_mrp: true, enabled: true };
  const overrides = rules.filter((r) => r.scope !== "global");

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "13px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#19202e" }}>Repricing rules</span>
        <span style={{ fontSize: 12, color: "#8A93A6" }}>{ruleSummary(global)}{overrides.length ? ` · ${overrides.length} category override${overrides.length === 1 ? "" : "s"}` : ""} {open ? "▲" : "▼"}</span>
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
  return `${d} under ${r.basis === "cheapest" ? "cheapest" : "market avg"}${r.never_above_mrp ? " · never above MRP" : ""}`;
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
        <option value="market_avg">market avg</option><option value="cheapest">cheapest</option>
      </select>
      <label style={{ fontSize: 12, color: "#56627A", display: "flex", alignItems: "center", gap: 5 }}>
        <input type="checkbox" checked={f.never_above_mrp} onChange={(e) => setF({ ...f, never_above_mrp: e.target.checked })} /> ≤ MRP
      </label>
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
