"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ProductRow } from "@/lib/admin/data";
import { bulkUpdatePricing, deleteProduct } from "@/lib/admin/actions";
import { packagingLabel } from "@/lib/admin/import";
import { wholesalePrice, offMrpPct } from "@/lib/pricing";
import { fmt } from "@/lib/format";

type Edit = { mrp: string; elume: string };

/** Inline-editable pricing grid — change MRP / Elume for any row, then save all
 *  dirty rows in one click. Live wholesale + %-off recompute as you type. */
export default function PricingTable({ rows }: { rows: ProductRow[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);

  const cats = useMemo(() => ["All", ...Array.from(new Set(rows.map((r) => r.category))).sort()], [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const inCat = cat === "All" || r.category === cat;
      const inSearch = !needle || `${r.name} ${r.sku} ${r.brand} ${r.category}`.toLowerCase().includes(needle);
      return inCat && inSearch;
    });
  }, [rows, q, cat]);

  const valOf = (r: ProductRow) => ({
    mrp: edits[r.id]?.mrp ?? String(r.mrp),
    elume: edits[r.id]?.elume ?? String(r.elume_price),
  });

  const setEdit = (r: ProductRow, field: "mrp" | "elume", value: string) => {
    setEdits((prev) => {
      const base = prev[r.id] ?? { mrp: String(r.mrp), elume: String(r.elume_price) };
      const next = { ...base, [field === "mrp" ? "mrp" : "elume"]: value };
      // Drop the entry entirely if it matches the original (no longer dirty).
      if (next.mrp === String(r.mrp) && next.elume === String(r.elume_price)) {
        const { [r.id]: _drop, ...rest } = prev;
        return rest;
      }
      return { ...prev, [r.id]: next };
    });
  };

  const dirtyIds = Object.keys(edits);
  const dirtyCount = dirtyIds.length;

  const save = () => {
    const payload = dirtyIds
      .map((id) => ({ id, mrp: Number(edits[id].mrp), elume_price: Number(edits[id].elume) }))
      .filter((e) => Number.isFinite(e.mrp) && Number.isFinite(e.elume_price) && e.mrp > 0 && e.elume_price > 0);
    if (payload.length === 0) {
      setFlash({ ok: false, msg: "Enter valid positive numbers before saving." });
      return;
    }
    startTransition(async () => {
      const res = await bulkUpdatePricing(payload);
      if (res.ok) {
        setEdits({});
        setFlash({ ok: true, msg: `Saved ${payload.length} price change${payload.length === 1 ? "" : "s"}.` });
        router.refresh();
      } else {
        setFlash({ ok: false, msg: res.error });
      }
    });
  };

  const th: React.CSSProperties = { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", color: "#8A93A6", padding: "10px 12px", fontWeight: 600, position: "sticky", top: 0, background: "#fff", zIndex: 1 };
  const td: React.CSSProperties = { fontSize: 13, padding: "8px 12px", borderTop: "1px solid #F0F2F6", verticalAlign: "middle" };
  const priceInput: React.CSSProperties = { width: 84, border: "1px solid #E0E4ED", borderRadius: 8, padding: "6px 8px", fontSize: 13, textAlign: "right", outline: "none", fontVariantNumeric: "tabular-nums" };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, SKU, brand…"
          style={{ flex: "1 1 240px", minWidth: 200, border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 13px", fontSize: 13.5, outline: "none" }}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff" }}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{filtered.length} shown</span>
      </div>

      {flash && (
        <div style={{ background: flash.ok ? "#E6F5EE" : "#FBE9E4", color: flash.ok ? "#137a4b" : "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
          {flash.msg}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "auto", maxHeight: "68vh" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Packaging</th>
              <th style={{ ...th, textAlign: "right" }}>MRP ₹</th>
              <th style={{ ...th, textAlign: "right" }}>Elume ₹</th>
              <th style={{ ...th, textAlign: "right" }}>Off</th>
              <th style={{ ...th, textAlign: "right" }}>Wholesale</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const v = valOf(r);
              const mrp = Number(v.mrp);
              const elume = Number(v.elume);
              const dirty = !!edits[r.id];
              const valid = Number.isFinite(mrp) && Number.isFinite(elume) && mrp > 0 && elume > 0;
              return (
                <tr key={r.id} style={{ background: dirty ? "#F7F8FF" : undefined }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                      {r.name}
                      {!r.is_active && <span style={{ fontSize: 10.5, color: "#E0612A" }}>hidden</span>}
                      {r.parent_id && <span style={{ fontSize: 10, color: "#8A93A6", background: "#F0F2F6", padding: "1px 6px", borderRadius: 6 }}>variant</span>}
                      {r.is_recommended && <span style={{ fontSize: 10, color: "#4E5BDC", background: "#EEF0FE", padding: "1px 6px", borderRadius: 6 }}>rec</span>}
                    </div>
                    <div style={{ fontFamily: "var(--space-mono)", fontSize: 11, color: "#8A93A6" }}>{r.brand} · {r.sku}</div>
                  </td>
                  <td style={{ ...td, fontSize: 12.5, color: "#3A4358", whiteSpace: "nowrap" }}>{packagingLabel(r)}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <input type="number" step="any" value={v.mrp} onChange={(e) => setEdit(r, "mrp", e.target.value)} style={priceInput} />
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <input type="number" step="any" value={v.elume} onChange={(e) => setEdit(r, "elume", e.target.value)} style={{ ...priceInput, borderColor: dirty ? "#4E5BDC" : "#E0E4ED", fontWeight: 600 }} />
                  </td>
                  <td style={{ ...td, textAlign: "right", color: valid && elume <= mrp ? "#1F9D63" : "#C0392B", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {valid ? `${offMrpPct(elume, mrp)}%` : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#56627A", whiteSpace: "nowrap" }}>
                    {valid ? fmt(wholesalePrice(elume)) : "—"}
                  </td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <Link href={`/admin/products/${r.id}`} style={{ color: "#4E5BDC", fontWeight: 600, marginRight: 10, fontSize: 12.5 }}>Edit</Link>
                    <form action={deleteProduct} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <button style={{ color: "#C0392B", background: "none", border: "none", cursor: "pointer", fontSize: 12.5 }}>Delete</button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td style={{ ...td, color: "#8A93A6", padding: 24, textAlign: "center" }} colSpan={7}>No matching products.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Floating save bar */}
      {dirtyCount > 0 && (
        <div style={{ position: "sticky", bottom: 16, display: "flex", justifyContent: "center", marginTop: 16, pointerEvents: "none" }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 14, background: "#161D2B", color: "#fff", borderRadius: 12, padding: "10px 12px 10px 18px", boxShadow: "0 12px 30px rgba(20,24,45,.28)" }}>
            <span style={{ fontSize: 13.5 }}>{dirtyCount} price change{dirtyCount === 1 ? "" : "s"} unsaved</span>
            <button onClick={() => setEdits({})} disabled={pending} style={{ background: "transparent", color: "rgba(255,255,255,0.7)", border: "none", fontSize: 13, cursor: "pointer" }}>Discard</button>
            <button onClick={save} disabled={pending} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, border: "none", padding: "9px 18px", borderRadius: 9, cursor: pending ? "default" : "pointer", opacity: pending ? 0.7 : 1 }}>
              {pending ? "Saving…" : `Save ${dirtyCount}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
