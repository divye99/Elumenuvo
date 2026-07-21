"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { baseExGst } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { startOnlinePayment, confirmOnlinePayment } from "@/lib/order-actions";
import { identify } from "@/lib/analytics";
import { openRazorpay } from "@/lib/razorpay-checkout";

type Prefill = { name: string; email: string; phone: string; gstin: string; company: string; isBusiness: boolean; signedIn: boolean };

/** All Indian states + union territories, for the address dropdown. */
const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal",
  // Union territories
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

type Address = { line1: string; line2: string; line3: string; city: string; district: string; state: string; pin: string; country: string };
const emptyAddress = (): Address => ({ line1: "", line2: "", line3: "", city: "", district: "", state: "", pin: "", country: "India" });

/** One line for the order record: line1, line2, line3, City, District, State - PIN, Country. */
function composeAddress(a: Address): string {
  const statePin = [a.state, a.pin && `- ${a.pin}`].filter(Boolean).join(" ");
  return [a.line1, a.line2, a.line3, a.city, a.district, statePin, a.country].map((s) => s.trim()).filter(Boolean).join(", ");
}

/** First missing required field, or null when the address is complete. */
function addressError(a: Address, label: string): string | null {
  if (!a.line1.trim()) return `Please enter Address line 1 (${label}).`;
  if (!a.city.trim()) return `Please enter the city (${label}).`;
  if (!a.district.trim()) return `Please enter the district (${label}).`;
  if (!a.state) return `Please pick the state / union territory (${label}).`;
  if (!/^\d{6}$/.test(a.pin.trim())) return `Please enter a valid 6-digit PIN code (${label}).`;
  return null;
}

export default function CheckoutClient({ prefill, onlineEnabled }: { prefill: Prefill; onlineEnabled: boolean }) {
  const { items, total, baseTotal, gstTotal, clear } = useCart();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ orderId: string; total: number } | null>(null);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<{ status: "idle" | "checking" | "ok" | "err"; percent?: number; msg?: string }>({ status: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);

  // A validation error can be off-screen (the pay button is also in the sticky
  // summary), so always bring the message into view.
  useEffect(() => {
    if (err) errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [err]);

  const [f, setF] = useState({
    name: prefill.name, email: prefill.email, phone: prefill.phone,
    billing: emptyAddress(), shipping: emptyAddress(), sameAsBilling: true,
    gstin: prefill.gstin, wantGst: prefill.isBusiness || !!prefill.gstin,
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const setAddr = (which: "billing" | "shipping", k: keyof Address, v: string) =>
    setF((p) => ({ ...p, [which]: { ...p[which], [k]: v } }));

  const gst = useMemo(() => ({ base: baseTotal, tax: gstTotal }), [baseTotal, gstTotal]);

  // Business account with a GSTIN already on file: invoice it automatically and
  // never ask again at checkout.
  const gstOnFile = prefill.isBusiness && !!prefill.gstin;

  const orderInput = () => ({
    name: f.name, email: f.email, phone: f.phone,
    billing_address: composeAddress(f.billing),
    shipping_address: composeAddress(f.sameAsBilling ? f.billing : f.shipping),
    gstin: gstOnFile ? prefill.gstin : f.wantGst ? f.gstin : undefined,
    payment_method: "online", // pay-on-delivery is retired; Razorpay only
    items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, cat: i.cat })),
    discount_code: codeState.status === "ok" ? code.trim().toUpperCase() : undefined,
  });

  const applyCode = async () => {
    if (!code.trim()) return;
    if (!f.email.trim()) { setCodeState({ status: "err", msg: "Fill in your email first — codes can be tied to an email." }); return; }
    setCodeState({ status: "checking" });
    try {
      const r = await fetch("/api/discount/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim(), email: f.email.trim() }) });
      const d = await r.json();
      setCodeState(d.ok ? { status: "ok", percent: d.percent } : { status: "err", msg: d.error });
    } catch { setCodeState({ status: "err", msg: "Couldn't check the code — try again." }); }
  };
  const discount = codeState.status === "ok" ? Math.round(total * ((codeState.percent ?? 0) / 100) * 100) / 100 : 0;
  const payable = Math.round((total - discount) * 100) / 100;

  const submit = () =>
    start(async () => {
      setErr(null);

      // Client-side address checks before any server round-trip.
      if (!/^[0-9+\-\s]{8,15}$/.test(f.phone.trim())) { setErr("Please enter a valid phone number - it's required for delivery."); return; }
      const billErr = addressError(f.billing, "billing address");
      if (billErr) { setErr(billErr); return; }
      if (!f.sameAsBilling) {
        const shipErr = addressError(f.shipping, "shipping address");
        if (shipErr) { setErr(shipErr); return; }
      }
      if (!gstOnFile && f.wantGst && !/^[0-9]{2}[A-Z0-9]{13}$/.test(f.gstin.trim())) { setErr("Please enter a valid 15-character GSTIN, or untick the GST invoice option."); return; }
      if (!onlineEnabled) { setErr("Online payment is being enabled - ordering opens as soon as Razorpay goes live."); return; }

      const input = orderInput();

      // Pay online: create a Razorpay order, open the modal, verify, then persist.
      const started = await startOnlinePayment(input);
      if (started.ok) identify(input.email, input.name);
      if (!started.ok) { setErr(started.error); return; }
      let payment;
      try {
        payment = await openRazorpay({
          keyId: started.keyId, amount: started.amount, razorpayOrderId: started.razorpayOrderId,
          name: started.name, email: started.email, phone: started.phone, orderId: started.orderId,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Payment window failed to open."); return;
      }
      if (!payment) { setErr("Payment cancelled — you weren't charged."); return; }

      // The order was already persisted (as awaiting_payment) in step 1, so the
      // confirm only verifies the signature and flips it to paid — the amount
      // and contents come from the server-side row, never from the browser.
      const res = await confirmOnlinePayment({
        orderId: started.orderId,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });
      if (res.ok) { clear(); setDone({ orderId: res.orderId, total: res.total }); }
      else setErr(res.error);
    });

  if (done) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "40px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>Order confirmed</h1>
          <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 4px" }}>Order <b>{done.orderId}</b> · {fmt(done.total)} paid</p>
          <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 20px" }}>We&apos;ve got it — a confirmation is on its way to {f.email}. Pan-India delivery in 3–7 working days.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={`/track?order=${encodeURIComponent(done.orderId)}&email=${encodeURIComponent(f.email)}`} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Track order</Link>
            <Link href="/catalogue" style={{ background: "#EEF0FE", color: "#4E5BDC", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Continue shopping</Link>
          </div>
        </div>

        {/* Guests: nudge them to create an account so the order lands in their dashboard */}
        {!prefill.signedIn && (
          <div style={{ marginTop: 16, background: "linear-gradient(135deg,#EEF0FE,#F7F8FB)", border: "1px solid #D9DDFB", borderRadius: 16, padding: "24px 26px" }}>
            <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E" }}>Create an account to track this order</div>
            <p style={{ fontSize: 13, color: "#56627A", lineHeight: 1.6, margin: "6px 0 14px" }}>
              We&apos;ll link order <b>{done.orderId}</b> to <b>{f.email}</b> so you can follow it to your door, and never re-type your address again.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px 16px", marginBottom: 16 }}>
              {[
                ["📦", "Track every order in one place"],
                ["⚡", "One-tap checkout next time"],
                ["🧾", "All your GST invoices, downloadable"],
                ["💰", "Wholesale rates + 30-day credit when it launches"],
              ].map(([icon, text]) => (
                <div key={text} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: "#3A4358" }}>
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
            <Link
              href={`/signin?mode=signup&email=${encodeURIComponent(f.email)}`}
              style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 11 }}
            >
              Create my account →
            </Link>
            <span style={{ fontSize: 11.5, color: "#8A93A6", marginLeft: 12 }}>Takes 20 seconds. Your order is safe either way.</span>
          </div>
        )}
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#56627A" }}>Your cart is empty.</p>
        <Link href="/catalogue" style={{ color: "#4E5BDC", fontWeight: 600 }}>Browse the catalogue →</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 28px 56px" }}>
      <h1 style={{ fontFamily: GROTESK, fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", margin: "0 0 4px" }}>Checkout</h1>
      {!prefill.signedIn && (
        <p style={{ fontSize: 13, color: "#56627A", margin: "0 0 18px" }}>
          Checking out as a guest. <Link href="/signin" style={{ color: "#4E5BDC", fontWeight: 600 }}>Sign in</Link> to save your details and track orders.
        </p>
      )}

      <div className="co-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Contact */}
          <Section title="Contact">
            <Row>
              <Field label="Full name *"><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></Field>
              <Field label="Phone *"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" required style={inp} /></Field>
            </Row>
            <Field label="Email *"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} style={inp} /></Field>
          </Section>

          {/* Addresses */}
          <Section title="Billing address">
            <AddressFields a={f.billing} onChange={(k, v) => setAddr("billing", k, v)} />
            <label style={ck}><input type="checkbox" checked={f.sameAsBilling} onChange={(e) => set("sameAsBilling", e.target.checked)} /> Shipping address same as billing</label>
          </Section>
          {!f.sameAsBilling && (
            <Section title="Shipping address">
              <AddressFields a={f.shipping} onChange={(k, v) => setAddr("shipping", k, v)} />
            </Section>
          )}

          {/* GST. Business accounts already gave us their GSTIN at sign-up, so we
              just confirm it — they're never asked again. Everyone else is offered it. */}
          {gstOnFile ? (
            <Section title="GST invoice">
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 11, padding: "12px 14px" }}>
                <span style={{ fontSize: 17 }}>🧾</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#166A44" }}>A GST invoice will be issued automatically</div>
                  <div style={{ fontSize: 12.5, color: "#3A4358", marginTop: 3 }}>
                    {prefill.company && <><b>{prefill.company}</b> · </>}
                    <span style={{ fontFamily: "var(--space-mono)" }}>{prefill.gstin}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 4 }}>
                    Input tax credit claimable. To change your GSTIN, update it in{" "}
                    <Link href="/app" style={{ color: "#4E5BDC", fontWeight: 600 }}>your account</Link>.
                  </div>
                </div>
              </div>
            </Section>
          ) : (
            <Section title="GST invoice (optional)">
              <label style={ck}><input type="checkbox" checked={f.wantGst} onChange={(e) => set("wantGst", e.target.checked)} /> I want a GST invoice</label>
              {f.wantGst && <Field label="GSTIN *"><input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} placeholder="27AAACE1234F1Z5" style={{ ...inp, fontFamily: "var(--space-mono)" }} /></Field>}
              {!prefill.signedIn && (
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>
                  Buying for a business?{" "}
                  <Link href="/business" style={{ color: "#4E5BDC", fontWeight: 600 }}>Open a business account</Link>{" "}
                  and we&apos;ll invoice your GSTIN automatically, every time.
                </div>
              )}
            </Section>
          )}

          {/* Payment: online only (pay-on-delivery is retired) */}
          <Section title="Payment">
            {onlineEnabled ? (
              <div style={{ ...payOpt, borderColor: "#4E5BDC", background: "#F7F8FF", cursor: "default" }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <span><b>Pay online</b><br /><span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking · secure Razorpay checkout</span></span>
              </div>
            ) : (
              <div style={{ ...payOpt, borderColor: "#F0DFC0", background: "#FFF9EE", cursor: "default" }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <span>
                  <b style={{ color: "#8a6116" }}>Online payment is being enabled</b>
                  <br />
                  <span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking via Razorpay go live shortly. Ordering is paused until then.</span>
                </span>
              </div>
            )}
          </Section>

          {/* Pay CTA at the natural end of the form, so nobody has to scroll
              back up to the summary after filling everything in. */}
          <div ref={errRef} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
            {err && <div style={{ background: "#FBE9E4", color: "#9a3b16", fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Total payable (incl. GST)</div>
                <div style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{fmt(payable)}</div>
              </div>
              <button onClick={submit} disabled={pending || !onlineEnabled} title={onlineEnabled ? "" : "Online payment is being enabled - ordering opens shortly"} style={{ flex: 1, minWidth: 200, marginLeft: "auto", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", padding: 15, borderRadius: 11, cursor: pending || !onlineEnabled ? "default" : "pointer", opacity: pending || !onlineEnabled ? 0.6 : 1 }}>
                {pending ? "Opening payment…" : onlineEnabled ? `Pay securely · ${fmt(payable)}` : "Payments enabling soon"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 10 }}>
              🔒 Secured by Razorpay · you stay on Elume · UPI, cards, net banking &amp; wallets
            </div>
          </div>
        </div>

        {/* Order summary (sticky beside the form on desktop) */}
        <div className="co-summary" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "18px 20px", position: "sticky", top: 84 }}>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Order summary</div>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 7 }}>
              <span style={{ color: "#56627A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.qty}× {it.name}</span>
              <span style={{ fontFamily: GROTESK, fontWeight: 600 }}>{fmt(baseExGst(it.price, it.cat) * it.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10 }}>
            {/* Prices are quoted ex-GST, so always show the taxable value + GST. */}
            <SumRow label="Subtotal (excl. GST)" value={fmt(gst.base)} muted />
            <SumRow label="GST" value={fmt(gst.tax)} muted />
            <SumRow label="Delivery" value="Free" green />
            {discount > 0 && <SumRow label={`Discount (${codeState.percent}% · ${code.trim().toUpperCase()})`} value={`− ${fmt(discount)}`} green />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST</span></span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(payable)}</span>
            </div>
          </div>
          {/* Discount code */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 7 }}>
              <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeState({ status: "idle" }); }} placeholder="Discount code" style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, textTransform: "uppercase" }} />
              <button onClick={applyCode} disabled={codeState.status === "checking" || !code.trim()} style={{ border: "1.5px solid #4E5BDC", background: "#fff", color: "#4E5BDC", fontWeight: 700, fontSize: 12.5, borderRadius: 9, padding: "0 14px", cursor: "pointer", opacity: codeState.status === "checking" ? 0.6 : 1 }}>
                {codeState.status === "checking" ? "…" : codeState.status === "ok" ? "✓" : "Apply"}
              </button>
            </div>
            {codeState.status === "ok" && <div style={{ fontSize: 12, color: "#1F9D63", fontWeight: 600, marginTop: 5 }}>{codeState.percent}% off applied.</div>}
            {codeState.status === "err" && <div style={{ fontSize: 12, color: "#D14343", fontWeight: 600, marginTop: 5 }}>{codeState.msg}</div>}
          </div>
          <button onClick={submit} disabled={pending || !onlineEnabled} title={onlineEnabled ? "" : "Online payment is being enabled - ordering opens shortly"} style={{ width: "100%", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: 13, borderRadius: 11, cursor: pending || !onlineEnabled ? "default" : "pointer", opacity: pending || !onlineEnabled ? 0.6 : 1 }}>
            {pending ? "Opening payment…" : onlineEnabled ? `Pay securely · ${fmt(payable)}` : "Payments enabling soon"}
          </button>
          <div style={{ fontSize: 11, color: "#A0A7B5", textAlign: "center", marginTop: 8 }}>🔒 Secured by Razorpay</div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) { return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>; }

/** Structured Indian address: 3 lines, city/district, state dropdown, PIN, country (India). */
function AddressFields({ a, onChange }: { a: Address; onChange: (k: keyof Address, v: string) => void }) {
  return (
    <>
      <Field label="Address line 1 *"><input value={a.line1} onChange={(e) => onChange("line1", e.target.value)} placeholder="Flat / house no., building" style={inp} /></Field>
      <Field label="Address line 2"><input value={a.line2} onChange={(e) => onChange("line2", e.target.value)} placeholder="Street, area, locality" style={inp} /></Field>
      <Field label="Address line 3 (optional)"><input value={a.line3} onChange={(e) => onChange("line3", e.target.value)} placeholder="Landmark (optional)" style={inp} /></Field>
      <Row>
        <Field label="City *"><input value={a.city} onChange={(e) => onChange("city", e.target.value)} style={inp} /></Field>
        <Field label="District *"><input value={a.district} onChange={(e) => onChange("district", e.target.value)} style={inp} /></Field>
      </Row>
      <Row>
        <Field label="State / Union territory *">
          <select value={a.state} onChange={(e) => onChange("state", e.target.value)} style={{ ...inp, background: "#fff" }}>
            <option value="">Select state / UT…</option>
            {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="PIN code *"><input value={a.pin} onChange={(e) => onChange("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="110001" style={inp} /></Field>
      </Row>
      <Field label="Country"><input value={a.country} readOnly style={{ ...inp, background: "#F7F8FB", color: "#56627A" }} /></Field>
    </>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11.5, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function SumRow({ label, value, muted, green }: { label: string; value: string; muted?: boolean; green?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: muted ? "#8A93A6" : "#56627A" }}><span>{label}</span><span style={{ fontFamily: "var(--space-grotesk)", color: green ? "#1F9D63" : "#19202E", fontWeight: 600 }}>{value}</span></div>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", background: "#fff" };
const ck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358" };
const payOpt: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, border: "1.5px solid #E8EBF1", borderRadius: 11, padding: "12px 13px", cursor: "pointer", fontSize: 13.5 };
