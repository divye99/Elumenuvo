"use client";

import { useState } from "react";

/**
 * "Use a saved one, or add a new one" - the control used for GSTINs and phone
 * numbers at checkout.
 *
 * A repeat order might change the address but not the GSTIN, the GSTIN but not
 * the address, both or neither, so each field owns its own picker and none of
 * them are coupled. Adding a new value here selects it immediately and it is
 * saved with the order, so it appears in this list and in account settings
 * from then on.
 *
 * Chips wrap rather than scroll: on a phone a horizontal scroller hides
 * options behind an edge the customer cannot see, and picking the right GST
 * registration is not something to hide.
 */

export type PickerOption = { id: string; value: string; label?: string; sub?: string };

export default function SavedPicker({
  options, selected, onSelect, onAddNew, addLabel, placeholder, mono = false, maxLength, inputMode,
}: {
  options: PickerOption[];
  /** The current value, matched against option.value. */
  selected: string;
  onSelect: (value: string) => void;
  /** Called when a new value is committed. Return an error string to reject. */
  onAddNew: (value: string) => string | null;
  addLabel: string;
  placeholder: string;
  mono?: boolean;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel";
}) {
  const [adding, setAdding] = useState(options.length === 0);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const commit = () => {
    const problem = onAddNew(draft.trim());
    if (problem) { setErr(problem); return; }
    setErr(null); setDraft(""); setAdding(false);
  };

  const chip = (on: boolean): React.CSSProperties => ({
    display: "inline-flex", flexDirection: "column", gap: 1, textAlign: "left",
    border: `1.5px solid ${on ? "#1D2F8A" : "#E0E4ED"}`,
    background: on ? "#F5F6FF" : "#fff",
    borderRadius: 10, padding: "8px 12px", cursor: "pointer", minWidth: 0, maxWidth: "100%",
  });

  return (
    <div>
      {options.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: adding ? 10 : 0 }}>
          {options.map((o) => {
            const on = o.value === selected;
            return (
              <button key={o.id} type="button" onClick={() => { onSelect(o.value); setAdding(false); setErr(null); }} style={chip(on)}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#19202E", fontFamily: mono ? "var(--space-mono)" : undefined, overflowWrap: "anywhere" }}>
                  {o.value}
                </span>
                {(o.label || o.sub) && (
                  <span style={{ fontSize: 11, color: "#8A93A6", overflowWrap: "anywhere" }}>{o.label || o.sub}</span>
                )}
              </button>
            );
          })}
          {!adding && (
            <button type="button" onClick={() => { setAdding(true); setErr(null); }} style={{ ...chip(false), borderStyle: "dashed", color: "#1D2F8A", fontWeight: 700, fontSize: 13, justifyContent: "center" }}>
              + {addLabel}
            </button>
          )}
        </div>
      )}

      {adding && (
        <div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={draft}
              onChange={(e) => { setDraft(mono ? e.target.value.toUpperCase() : e.target.value); setErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
              placeholder={placeholder}
              maxLength={maxLength}
              inputMode={inputMode}
              style={{
                flex: "1 1 200px", minWidth: 0, boxSizing: "border-box",
                border: `1px solid ${err ? "#F0BBA8" : "#E0E4ED"}`, borderRadius: 10, padding: "10px 12px",
                fontSize: 14, fontFamily: mono ? "var(--space-mono)" : undefined,
              }}
            />
            <button type="button" onClick={commit} style={{ flex: "0 0 auto", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", borderRadius: 10, padding: "10px 16px", cursor: "pointer" }}>
              Use this
            </button>
            {options.length > 0 && (
              <button type="button" onClick={() => { setAdding(false); setDraft(""); setErr(null); }} style={{ flex: "0 0 auto", background: "none", border: "none", color: "#8A93A6", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
            )}
          </div>
          {err && <div style={{ fontSize: 11.5, color: "#C2410C", fontWeight: 600, marginTop: 5 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
