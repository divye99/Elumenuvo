"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions";

export type LeadField = {
  name: string;
  label: string;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "textarea";
  required?: boolean;
  half?: boolean; // render two-up on desktop
};

/** Generic public lead form (Sell on Elume / product requests). The bound
 *  server action arrives as a prop so one component serves both pages. */
export default function LeadForm({
  action,
  fields,
  submitLabel,
  footnote,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  fields: LeadField[];
  submitLabel: string;
  footnote?: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  if (state?.ok) {
    return (
      <div style={{ background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 14, padding: "26px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 6 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#166A44" }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      {fields.map((f) => (
        <label key={f.name} style={{ flex: f.half ? "1 1 46%" : "1 1 100%", minWidth: f.half ? 180 : undefined, display: "flex", flexDirection: "column", gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#3A4358" }}>
            {f.label}
            {f.required && <span style={{ color: "#D14343" }}> *</span>}
          </span>
          {f.type === "textarea" ? (
            <textarea name={f.name} required={f.required} placeholder={f.placeholder} rows={4} style={{ ...inp, resize: "vertical" }} />
          ) : (
            <input name={f.name} type={f.type ?? "text"} required={f.required} placeholder={f.placeholder} style={inp} />
          )}
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        style={{ flex: "1 1 100%", background: "#4E5BDC", color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 11, padding: "13px 22px", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Submitting…" : submitLabel}
      </button>
      {state && !state.ok && <span style={{ flex: "1 1 100%", fontSize: 13, fontWeight: 600, color: "#D14343" }}>{state.message}</span>}
      {footnote && <span style={{ flex: "1 1 100%", fontSize: 11.5, color: "#8A93A6" }}>{footnote}</span>}
    </form>
  );
}

const inp: React.CSSProperties = {
  border: "1px solid #E0E4ED",
  borderRadius: 11,
  padding: "11px 13px",
  fontSize: 13.5,
  color: "#19202E",
  outline: "none",
  background: "#FBFCFE",
  fontFamily: "inherit",
};
