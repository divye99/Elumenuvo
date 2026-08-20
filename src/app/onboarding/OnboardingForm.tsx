"use client";

import { useActionState, useEffect, useState } from "react";
import { Mark, Wordmark } from "@/components/Brand";
import { saveProfile, type ProfileState } from "@/lib/profile-actions";
import { readCheckoutDraft } from "@/lib/checkout-draft";

export const BUSINESS_TYPES = [
  "Contractor",
  "Builder / developer",
  "Electrical retailer / distributor",
  "Electrician",
  "MEP consultant",
  "Facility management",
  "Interior fit-out",
  "Other",
];

export default function OnboardingForm({
  defaultName, defaultPhone = "", defaultGstin = "",
}: { defaultName: string; defaultPhone?: string; defaultGstin?: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, null);
  const [type, setType] = useState<"business" | "individual" | null>(null);
  // Split any name captured at sign-up into first / last for the two fields.
  const parts = (defaultName ?? "").trim().split(/\s+/).filter(Boolean);
  const defaultFirst = parts[0] ?? "";
  const defaultLast = parts.slice(1).join(" ");

  /* ── Never ask twice ──
     Someone who filled checkout as a guest and then created an account has
     already given us their phone and GSTIN; asking again produced three
     different phone numbers in one session. The server passes anything on a
     past order; the checkout draft covers the commoner case where the account
     is created BEFORE the order row exists. ── */
  const [phone, setPhone] = useState(defaultPhone);
  const [gstin, setGstin] = useState(defaultGstin);
  const [reused, setReused] = useState(false);
  useEffect(() => {
    const d = readCheckoutDraft();
    if (!d) return;
    let used = false;
    if (!defaultPhone && d.phone?.trim()) { setPhone(d.phone.trim()); used = true; }
    if (!defaultGstin && d.gstin?.trim()) { setGstin(d.gstin.trim()); used = true; }
    // A GSTIN in hand means they are buying as a business; preselect it rather
    // than making them assert it again.
    if ((defaultGstin || d.gstin?.trim()) && !type) setType("business");
    if (used) setReused(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", fontFamily: "var(--hanken)", padding: 20 }}>
      <div style={{ width: 460, maxWidth: "100%", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Mark height={26} /><Wordmark height={15} />
        </div>
        <h1 style={{ fontSize: 21, fontWeight: 700, margin: "0 0 4px" }}>Welcome to Elume</h1>
        <p style={{ fontSize: 13.5, color: "#8A93A6", margin: "0 0 20px" }}>Tell us who you&apos;re buying as - it tailors your pricing and workspace.</p>

        <form action={action}>
          {/* Account type */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {(["business", "individual"] as const).map((t) => (
              <label key={t} style={{ cursor: "pointer" }}>
                <input type="radio" name="account_type" value={t} checked={type === t} onChange={() => setType(t)} style={{ display: "none" }} />
                <div style={{ border: `1.5px solid ${type === t ? "#1D2F8A" : "#E0E4ED"}`, background: type === t ? "#F7F8FF" : "#fff", borderRadius: 12, padding: "16px 14px" }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t === "business" ? "🏢" : "🏠"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#19202E" }}>{t === "business" ? "Business" : "Individual"}</div>
                  <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 3, lineHeight: 1.4 }}>
                    {t === "business" ? "GST invoicing, projects, bulk & credit" : "Simple browsing and ordering"}
                  </div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="First name"><input name="first_name" defaultValue={defaultFirst} required style={inp} /></Field>
            <Field label="Last name"><input name="last_name" defaultValue={defaultLast} required style={inp} /></Field>
          </div>

          {type === "business" && (
            <>
              <Field label="Company name"><input name="company" required style={inp} placeholder="Acme Electricals Pvt Ltd" /></Field>
              <Field label="GSTIN">
                <input name="gstin" required value={gstin} onChange={(e) => setGstin(e.target.value)} style={{ ...inp, textTransform: "uppercase", fontFamily: "var(--space-mono)" }} placeholder="27AAACE1234F1Z5" maxLength={15} />
                <span style={{ fontSize: 11, color: "#8A93A6", display: "block", marginTop: 4 }}>
                  We&apos;ll put this on every invoice automatically, so you&apos;ll never be asked for it at checkout.
                </span>
              </Field>
              <Field label="Type of business">
                <select name="business_type" required style={inp} defaultValue="">
                  <option value="" disabled>Select…</option>
                  {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </>
          )}
          <Field label="Phone (optional)">
            <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} style={inp} placeholder="+91 98765 43210" />
          </Field>

          {reused && (
            <p style={{ fontSize: 11.5, color: "#137a4b", background: "#F2FBF6", border: "1px solid #DCEDE3", borderRadius: 8, padding: "7px 10px", margin: "0 0 12px" }}>
              We&apos;ve carried over what you entered at checkout. Edit anything that looks wrong.
            </p>
          )}

          {state && !state.ok && <p style={{ fontSize: 12.5, color: "#F25929", margin: "2px 0 10px" }}>{state.message}</p>}

          <button disabled={pending || !type} style={{ width: "100%", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", padding: 12, borderRadius: 10, cursor: pending || !type ? "default" : "pointer", opacity: pending || !type ? 0.6 : 1, marginTop: 6 }}>
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
