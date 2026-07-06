"use client";

import { useActionState, useState } from "react";
import { Mark, Wordmark } from "@/components/Brand";
import { saveProfile, type ProfileState } from "@/lib/profile-actions";

export default function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, null);
  const [type, setType] = useState<"business" | "individual" | null>(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", fontFamily: "var(--hanken)", padding: 20 }}>
      <div style={{ width: 460, maxWidth: "100%", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Mark height={26} /><Wordmark height={15} />
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Welcome to Elume</h1>
        <p style={{ fontSize: 13.5, color: "#8A93A6", margin: "0 0 20px" }}>Tell us who you&apos;re buying as — it tailors your pricing and workspace.</p>

        <form action={action}>
          {/* Account type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {(["business", "individual"] as const).map((t) => (
              <label key={t} style={{ cursor: "pointer" }}>
                <input type="radio" name="account_type" value={t} checked={type === t} onChange={() => setType(t)} style={{ display: "none" }} />
                <div style={{ border: `1.5px solid ${type === t ? "#4E5BDC" : "#E0E4ED"}`, background: type === t ? "#F7F8FF" : "#fff", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t === "business" ? "🏢" : "🏠"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#19202E" }}>{t === "business" ? "Business" : "Individual"}</div>
                  <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 3, lineHeight: 1.4 }}>
                    {t === "business" ? "GST invoicing, projects, bulk & credit" : "Simple browsing and ordering"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <Field label="Your name"><input name="full_name" defaultValue={defaultName} required style={inp} /></Field>

          {type === "business" && (
            <>
              <Field label="Company name"><input name="company" required style={inp} placeholder="Acme Electricals Pvt Ltd" /></Field>
              <Field label="GSTIN"><input name="gstin" required style={{ ...inp, textTransform: "uppercase", fontFamily: "var(--space-mono)" }} placeholder="27AAACE1234F1Z5" maxLength={15} /></Field>
            </>
          )}
          <Field label="Phone (optional)"><input name="phone" style={inp} placeholder="+91 98765 43210" /></Field>

          {state && !state.ok && <p style={{ fontSize: 12.5, color: "#E0612A", margin: "2px 0 10px" }}>{state.message}</p>}

          <button disabled={pending || !type} style={{ width: "100%", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", padding: 12, borderRadius: 10, cursor: pending || !type ? "default" : "pointer", opacity: pending || !type ? 0.6 : 1, marginTop: 6 }}>
            {pending ? "Saving…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 5 }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none" };
