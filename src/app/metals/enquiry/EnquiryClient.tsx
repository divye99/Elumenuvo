"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitMetalEnquiry } from "@/app/metals/actions";
import { ENQUIRY_METALS } from "@/lib/metals";
import { GROTESK } from "@/lib/fonts";

/**
 * Business-format metals enquiry: company + GSTIN (the genuine-buyer filter),
 * contact details, the metal, and a free-text requirement box. Lands in
 * metal_enquiries + pings info@ instantly.
 */
const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #E0E4ED",
  borderRadius: 10,
  padding: "11px 13px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  fontFamily: "inherit",
};
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#56627A", display: "block", margin: "0 0 6px" };

export default function EnquiryClient({ preselect }: { preselect: string }) {
  const [f, setF] = useState({
    company: "",
    gstin: "",
    name: "",
    email: "",
    phone: "",
    metal: ENQUIRY_METALS.includes(preselect) ? preselect : "",
    message: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const res = await submitMetalEnquiry(f);
      if (res.ok) setDone(true);
      else setErr(res.error);
    });
  }

  if (done) {
    return (
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "60px 30px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 42 }}>✅</div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 600, letterSpacing: "-0.6px", margin: "14px 0 10px", color: "#19202E" }}>
          Enquiry received
        </h1>
        <p style={{ fontSize: 14.5, color: "#56627A", lineHeight: 1.6, margin: "0 0 24px" }}>
          Thanks, {f.name.split(" ")[0] || "there"} - our sourcing desk has your {f.metal.toLowerCase()} requirement and
          will come back to {f.email} with a firm quote, usually within one working day.
        </p>
        <Link href="/metals" style={{ display: "inline-block", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 22px", borderRadius: 11 }}>
          Back to Metals →
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "34px 30px 80px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Metals · sourcing desk</div>
      <h1 style={{ fontFamily: GROTESK, fontSize: 28, fontWeight: 600, letterSpacing: "-0.7px", margin: "6px 0 8px", color: "#19202E" }}>
        Raise a metals enquiry
      </h1>
      <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.6, margin: "0 0 26px" }}>
        Tell us the metal, grade, quantity and delivery point. Enquiries are GSTIN-verified, so genuine trade buyers
        hear back fastest - usually within one working day.
      </p>

      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "26px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={label}>Company name</label>
          <input style={inp} value={f.company} onChange={set("company")} placeholder="Acme Industries Pvt Ltd" required />
        </div>
        <div>
          <label style={label}>GSTIN</label>
          <input
            style={{ ...inp, fontFamily: "var(--space-mono)", textTransform: "uppercase", letterSpacing: "0.5px" }}
            value={f.gstin}
            onChange={set("gstin")}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            required
          />
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 5 }}>15 characters - we verify this before quoting.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={label}>Your name</label>
            <input style={inp} value={f.name} onChange={set("name")} placeholder="Full name" required />
          </div>
          <div>
            <label style={label}>Phone</label>
            <input style={inp} value={f.phone} onChange={set("phone")} placeholder="+91 98xxxxxx00" inputMode="tel" required />
          </div>
        </div>
        <div>
          <label style={label}>Work email</label>
          <input style={inp} type="email" value={f.email} onChange={set("email")} placeholder="you@company.com" required />
        </div>
        <div>
          <label style={label}>Metal</label>
          <select style={{ ...inp, appearance: "auto" }} value={f.metal} onChange={set("metal")} required>
            <option value="" disabled>Select a metal…</option>
            {ENQUIRY_METALS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>Your requirement, in detail</label>
          <textarea
            style={{ ...inp, minHeight: 120, resize: "vertical", lineHeight: 1.55 }}
            value={f.message}
            onChange={set("message")}
            placeholder="Grade / spec, quantity (MT), delivery location, timeline, and anything else we should know…"
            required
          />
        </div>

        {err && (
          <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "10px 13px", fontSize: 13 }}>
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          style={{ background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: "13px 22px", borderRadius: 11, cursor: "pointer", opacity: pending ? 0.7 : 1 }}
        >
          {pending ? "Sending…" : "Send enquiry"}
        </button>
        <p style={{ fontSize: 11.5, color: "#8A93A6", margin: 0, lineHeight: 1.5 }}>
          Your details go only to our sourcing desk (info@elumenuvo.com) and are never shared.
        </p>
      </form>
    </main>
  );
}
