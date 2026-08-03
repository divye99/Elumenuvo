"use client";

import { useState } from "react";
import { GROTESK, MONO } from "@/lib/fonts";
import { addSavedGstin, addSavedPhone, removeSavedItem, labelSavedItem, type SavedKind } from "@/lib/saved-field-actions";
import { PHONE_SOURCE_LABEL } from "@/lib/saved-fields";

/**
 * The GSTIN and phone books in account settings.
 *
 * Everything the customer has ever given us is listed here, labelled with
 * where it came from, so three phone numbers read as "account contact",
 * "delivery contact" and "used at checkout" rather than three anonymous
 * strings. Each can be renamed, and new ones added by hand.
 *
 * The last entry of either kind cannot be removed: emptying the list would put
 * the next checkout back to typing everything out, which is the exact problem
 * these lists exist to solve.
 *
 * Laid out to wrap on a phone: rows become stacked blocks rather than a table
 * that scrolls sideways.
 */

export type GstinRow = { id: string; gstin: string; label: string; state: string };
export type PhoneRow = { id: string; phone: string; label: string; source: string };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginTop: 16 };
const rowBox: React.CSSProperties = { border: "1px solid #EEF0F4", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" };
const removeBtn = (busy: boolean): React.CSSProperties => ({
  border: "1px solid #E8EBF1", background: "#fff", color: "#D14343", fontSize: 12.5, fontWeight: 700,
  borderRadius: 9, padding: "7px 13px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1, flex: "0 0 auto",
});
const addRow: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 };
const inp: React.CSSProperties = { flex: "1 1 160px", minWidth: 0, boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13.5 };
const addBtn: React.CSSProperties = { flex: "0 0 auto", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 9, padding: "9px 16px", cursor: "pointer" };

function useRemove<T extends { id: string }>(kind: SavedKind, setRows: React.Dispatch<React.SetStateAction<T[]>>) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const remove = async (id: string) => {
    setBusyId(id); setErr(null);
    const res = await removeSavedItem(kind, id);
    setBusyId(null);
    if (res.ok) setRows((p) => p.filter((r) => r.id !== id));
    else setErr(res.error ?? "Could not remove that.");
  };
  return { busyId, err, setErr, remove };
}

/** Inline rename, so a number can be called what it actually is. */
function LabelEditor({ kind, id, value, placeholder }: { kind: "gstin" | "phone"; id: string; value: string; placeholder: string }) {
  const [label, setLabel] = useState(value);
  const [saved, setSaved] = useState(false);
  return (
    <input
      value={label}
      placeholder={placeholder}
      onChange={(e) => { setLabel(e.target.value); setSaved(false); }}
      onBlur={async () => { const r = await labelSavedItem(kind, id, label); setSaved(r.ok); }}
      style={{ ...inp, flex: "1 1 150px", fontSize: 12.5, padding: "6px 9px", borderColor: saved ? "#8FD3B0" : "#E0E4ED" }}
    />
  );
}

export function GstinBook({ initial }: { initial: GstinRow[] }) {
  const [rows, setRows] = useState(initial);
  const { busyId, err, setErr, remove } = useRemove<GstinRow>("gstin", setRows);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true); setErr(null);
    const res = await addSavedGstin(draft, name);
    setAdding(false);
    if (!res.ok) { setErr(res.error ?? "Could not save that GSTIN."); return; }
    setRows((p) => [{ id: crypto.randomUUID(), gstin: draft.trim().toUpperCase(), label: name.trim(), state: res.state ?? "" }, ...p]);
    setDraft(""); setName("");
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>GST registrations</div>
      <div style={{ fontSize: 12.5, color: "#8A93A6" }}>
        Hold as many as you need, one per registration. Pick the right one at checkout instead of typing it.
      </div>

      {rows.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: "#8A93A6", background: "#F8F9FC", border: "1px solid #EEF0F4", borderRadius: 10, padding: "14px 16px" }}>
          None saved yet. Add one below, or enter it at checkout and it will be kept.
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((g) => (
            <div key={g.id} style={rowBox}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 13.5, fontWeight: 700, color: "#19202E", overflowWrap: "anywhere" }}>{g.gstin}</div>
                {g.state && <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 2 }}>{g.state}</div>}
              </div>
              <LabelEditor kind="gstin" id={g.id} value={g.label} placeholder="Name it, e.g. Head office" />
              <button onClick={() => remove(g.id)} disabled={busyId === g.id} style={removeBtn(busyId === g.id)}>
                {busyId === g.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={addRow}>
        <input value={draft} onChange={(e) => { setDraft(e.target.value.toUpperCase()); setErr(null); }} maxLength={15} placeholder="Add a GSTIN" style={{ ...inp, fontFamily: MONO }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" style={inp} />
        <button onClick={add} disabled={adding || draft.trim().length !== 15} style={{ ...addBtn, opacity: adding || draft.trim().length !== 15 ? 0.55 : 1 }}>
          {adding ? "Checking…" : "Add"}
        </button>
      </div>
      {err && <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 600, color: "#D14343" }}>{err}</div>}
    </div>
  );
}

export function PhoneBook({ initial }: { initial: PhoneRow[] }) {
  const [rows, setRows] = useState(initial);
  const { busyId, err, setErr, remove } = useRemove<PhoneRow>("phone", setRows);
  const [draft, setDraft] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const add = async () => {
    setAdding(true); setErr(null);
    const res = await addSavedPhone(draft, name);
    setAdding(false);
    if (!res.ok) { setErr(res.error ?? "Could not save that number."); return; }
    setRows((p) => [{ id: crypto.randomUUID(), phone: draft.trim(), label: name.trim(), source: "manual" }, ...p]);
    setDraft(""); setName("");
  };

  return (
    <div style={card}>
      <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>Phone numbers</div>
      <div style={{ fontSize: 12.5, color: "#8A93A6" }}>
        Every number you have given us, and where it came from. Choose which one a delivery should use at checkout.
      </div>

      {rows.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: "#8A93A6", background: "#F8F9FC", border: "1px solid #EEF0F4", borderRadius: 10, padding: "14px 16px" }}>
          None saved yet.
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((p) => (
            <div key={p.id} style={rowBox}>
              <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{p.phone}</div>
                <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 2 }}>{PHONE_SOURCE_LABEL[p.source] ?? "Saved"}</div>
              </div>
              <LabelEditor kind="phone" id={p.id} value={p.label} placeholder="Name it, e.g. Site foreman" />
              <button onClick={() => remove(p.id)} disabled={busyId === p.id} style={removeBtn(busyId === p.id)}>
                {busyId === p.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={addRow}>
        <input value={draft} onChange={(e) => { setDraft(e.target.value); setErr(null); }} inputMode="tel" placeholder="Add a number" style={inp} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" style={inp} />
        <button onClick={add} disabled={adding || draft.trim().length < 10} style={{ ...addBtn, opacity: adding || draft.trim().length < 10 ? 0.55 : 1 }}>
          {adding ? "Saving…" : "Add"}
        </button>
      </div>
      {err && <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 600, color: "#D14343" }}>{err}</div>}
    </div>
  );
}
