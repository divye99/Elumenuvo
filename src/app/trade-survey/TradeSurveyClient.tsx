"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import { submitTradeSurvey } from "./actions";

/**
 * 4 questions + company + phone, chip-based so it really is two minutes.
 * On submit: the TRADE5 reward code with a straight path into the store.
 * No credit-terms question by decision (2026-08-03).
 */
const BUYS = ["Wires & cables", "Switchgear (MCB/RCCB/DB)", "Lighting", "Fans", "Modular switches", "Everything electrical"];
const CHANNEL = ["Local distributor", "IndiaMART", "Amazon / Flipkart", "Direct from brands", "A mix of these"];
const PRIORITY = ["Lowest price", "Delivery speed", "GST billing", "Brand range", "One point of contact"];

export default function TradeSurveyClient() {
  const [buys, setBuys] = useState<string[]>([]);
  const [channel, setChannel] = useState("");
  const [priority, setPriority] = useState<string[]>([]);
  const [missing, setMissing] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, v: string, max = 6) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list);

  const submit = () =>
    start(async () => {
      setErr(null);
      const res = await submitTradeSurvey({
        company, phone,
        buys: buys.join(", "), channel, priority: priority.join(", "), missing,
      });
      if (res.ok) setDone(true);
      else setErr(res.error);
    });

  const chip = (on: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, padding: "9px 14px", borderRadius: 20, cursor: "pointer", userSelect: "none",
    background: on ? "#1D2F8A" : "#fff", color: on ? "#fff" : "#3A4358", border: `1.5px solid ${on ? "#1D2F8A" : "#E0E4ED"}`,
  });
  const label: React.CSSProperties = { fontFamily: GROTESK, fontSize: 15.5, fontWeight: 600, margin: "0 0 10px" };
  const inp: React.CSSProperties = { width: "100%", border: "1px solid #E0E4ED", borderRadius: 10, padding: "11px 13px", fontSize: 14, boxSizing: "border-box" };

  if (done) {
    return (
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "56px 24px 80px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🙏</div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 700, margin: "0 0 8px" }}>Thank you - that genuinely helps.</h1>
        <p style={{ fontSize: 14.5, color: "#56627A", margin: "0 0 22px" }}>As promised, here is your code for 5% off your first order:</p>
        <div style={{ display: "inline-block", fontFamily: "var(--space-mono)", fontSize: 26, fontWeight: 700, letterSpacing: 3, background: "#EEF0FD", border: "2px dashed #1D2F8A", color: "#232B6E", borderRadius: 12, padding: "14px 30px" }}>TRADE5</div>
        <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "14px 0 26px" }}>Apply it in the discount box at checkout. Valid till 30 November 2026.</p>
        <Link href="/catalogue?utm_source=email&utm_medium=outreach&utm_campaign=trade100-survey" style={{ display: "inline-block", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14.5, padding: "13px 26px", borderRadius: 11 }}>
          Browse the catalogue →
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 620, margin: "0 auto", padding: "40px 24px 80px" }}>
      <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "0 0 6px" }}>Two minutes, five taps.</h1>
      <p style={{ fontSize: 14.5, color: "#56627A", margin: "0 0 6px" }}>
        We're building India's most transparent electricals supplier for builders, contractors and architects.
        Tell us how you buy, and we'll build around it.
      </p>
      <p style={{ fontSize: 13, color: "#1F9D63", fontWeight: 700, margin: "0 0 26px" }}>Finish and get TRADE5: 5% off your first order.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div>
          <p style={label}>1. What do you buy most often?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {BUYS.map((b) => <span key={b} onClick={() => toggle(buys, setBuys, b)} style={chip(buys.includes(b))}>{b}</span>)}
          </div>
        </div>
        <div>
          <p style={label}>2. How do you buy today?</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHANNEL.map((c) => <span key={c} onClick={() => setChannel(c)} style={chip(channel === c)}>{c}</span>)}
          </div>
        </div>
        <div>
          <p style={label}>3. What matters most in a supplier? <span style={{ fontWeight: 400, fontSize: 12.5, color: "#8A93A6" }}>pick up to two</span></p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {PRIORITY.map((p) => <span key={p} onClick={() => toggle(priority, setPriority, p, 2)} style={chip(priority.includes(p))}>{p}</span>)}
          </div>
        </div>
        <div>
          <p style={label}>4. What's missing from elumenuvo.com for your kind of work?</p>
          <textarea value={missing} onChange={(e) => setMissing(e.target.value)} rows={3} placeholder="Anything - products we should stock, how billing should work, delivery, site coordination…" style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <p style={label}>Company name *</p>
            <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Your firm" style={inp} />
          </div>
          <div>
            <p style={label}>Phone *</p>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ ...inp, width: 56, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#56627A", background: "#F5F6F9" }}>+91</span>
              <input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="98xxxxxxxx" style={inp} />
            </div>
          </div>
        </div>

        {err && <div style={{ background: "#FBE9E4", color: "#9a3b16", fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 9 }}>{err}</div>}
        <button onClick={submit} disabled={pending} style={{ background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", padding: 14, borderRadius: 11, cursor: "pointer", opacity: pending ? 0.6 : 1 }}>
          {pending ? "Saving…" : "Submit · get TRADE5"}
        </button>
        <p style={{ fontSize: 11.5, color: "#8A93A6", margin: 0 }}>
          We use your answers to improve the store and may call you back on this number. Nothing is shared outside {`Elume`}.
        </p>
      </div>
    </main>
  );
}
