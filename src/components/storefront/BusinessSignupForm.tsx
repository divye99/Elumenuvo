"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GROTESK } from "@/lib/fonts";
import { createClient } from "@/lib/supabase/client";
import { saveBusinessProfile } from "@/lib/profile-actions";

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

const MONTHLY_SPEND = ["Under ₹50,000", "₹50,000 – ₹2 lakh", "₹2 – ₹10 lakh", "₹10 lakh+"];

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Open-a-business-account form. Creates the auth user (or upgrades the
 * signed-in one) and writes a business profile: company, GSTIN, business type
 * and contact. Once it exists, every order is GST-invoiced automatically and
 * the buyer is never asked for GST details at checkout again.
 */
export default function BusinessSignupForm({ signedIn, existingCompany }: { signedIn: boolean; existingCompany?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    company: existingCompany ?? "", gstin: "", business_type: "", monthly_spend: "",
    first_name: "", last_name: "", email: "", phone: "", password: "",
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!f.company.trim()) return setErr("Please enter your company name.");
    if (!GSTIN_RE.test(f.gstin.trim().toUpperCase())) return setErr("Please enter a valid 15-character GSTIN.");
    if (!f.business_type) return setErr("Please tell us what kind of business you are.");
    if (!f.first_name.trim() || !f.last_name.trim()) return setErr("Please enter the contact person's first and last name.");
    if (!/^[0-9+\-\s]{8,15}$/.test(f.phone.trim())) return setErr("Please enter a valid phone number.");
    if (!signedIn && f.password.length < 6) return setErr("Please choose a password of at least 6 characters.");

    setBusy(true);
    try {
      // New customer: create the account first (signed-in users skip this).
      if (!signedIn) {
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email: f.email.trim(), password: f.password,
          options: { data: { first_name: f.first_name.trim(), last_name: f.last_name.trim(), full_name: `${f.first_name.trim()} ${f.last_name.trim()}`, phone: f.phone.trim() } },
        });
        if (error) throw error;
      }

      // Write the business profile (server-side; works whether the signup
      // returned a session immediately or the user is already signed in).
      const res = await saveBusinessProfile({
        company: f.company.trim(),
        gstin: f.gstin.trim().toUpperCase(),
        business_type: f.business_type,
        first_name: f.first_name.trim(),
        last_name: f.last_name.trim(),
        phone: f.phone.trim(),
      });

      if (!res.ok) {
        // No session yet => Supabase requires email confirmation first.
        setErr(res.needsConfirmation
          ? "Account created. Please confirm your email, then sign in and we'll finish setting up your business account."
          : res.message);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 26px" }}>
      <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, marginBottom: 4 }}>Open a business account</div>
      <p style={{ fontSize: 12.5, color: "#56627A", margin: "0 0 18px", lineHeight: 1.5 }}>
        GST-invoiced automatically on every order, wholesale rates built in, and 30-day credit when it launches.
      </p>

      <Group title="Your business">
        <Field label="Company name *"><input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Acme Electricals Pvt Ltd" style={inp} /></Field>
        <Row>
          <Field label="GSTIN *">
            <input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} placeholder="27AAACE1234F1Z5" style={{ ...inp, fontFamily: "var(--space-mono)" }} />
          </Field>
          <Field label="Type of business *">
            <select value={f.business_type} onChange={(e) => set("business_type", e.target.value)} style={inp}>
              <option value="">Select…</option>
              {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
        </Row>
        <Field label="Monthly electrical spend (optional)">
          <select value={f.monthly_spend} onChange={(e) => set("monthly_spend", e.target.value)} style={inp}>
            <option value="">Prefer not to say</option>
            {MONTHLY_SPEND.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <span style={{ fontSize: 11, color: "#8A93A6", display: "block", marginTop: 4 }}>Helps us set your wholesale tier and credit limit.</span>
        </Field>
      </Group>

      <Group title="Contact person">
        <Row>
          <Field label="First name *"><input value={f.first_name} onChange={(e) => set("first_name", e.target.value)} style={inp} autoComplete="given-name" /></Field>
          <Field label="Last name *"><input value={f.last_name} onChange={(e) => set("last_name", e.target.value)} style={inp} autoComplete="family-name" /></Field>
        </Row>
        <Row>
          {!signedIn && <Field label="Work email *"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} style={inp} autoComplete="email" /></Field>}
          <Field label="Phone *"><input type="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" style={inp} autoComplete="tel" /></Field>
        </Row>
        {!signedIn && (
          <Field label="Password *">
            <input type="password" value={f.password} onChange={(e) => set("password", e.target.value)} minLength={6} style={inp} autoComplete="new-password" />
          </Field>
        )}
      </Group>

      {err && <div style={{ background: "#FBE9E4", color: "#9a3b16", fontSize: 12.5, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 12 }}>{err}</div>}

      <button disabled={busy} style={{ width: "100%", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: 13, borderRadius: 11, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.7 : 1 }}>
        {busy ? "Creating your account…" : signedIn ? "Upgrade to a business account" : "Create business account"}
      </button>

      {!signedIn && (
        <div style={{ fontSize: 12, color: "#8A93A6", textAlign: "center", marginTop: 12 }}>
          Already have an account? <Link href="/signin" style={{ color: "#4E5BDC", fontWeight: 600 }}>Sign in</Link>
        </div>
      )}
    </form>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11.5, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 5 }}>{label}</label>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 10, padding: "10px 12px", fontSize: 13.5, outline: "none", background: "#fff" };
