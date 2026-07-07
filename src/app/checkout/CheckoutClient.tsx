"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { exGst, gstPart, GST_RATE } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import { placeOrder, startOnlinePayment, confirmOnlinePayment } from "@/lib/order-actions";
import { openRazorpay } from "@/lib/razorpay-checkout";

type Prefill = { name: string; email: string; phone: string; gstin: string; isBusiness: boolean; signedIn: boolean };

export default function CheckoutClient({ prefill, onlineEnabled }: { prefill: Prefill; onlineEnabled: boolean }) {
  const { items, total, clear } = useCart();
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ orderId: string; total: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [f, setF] = useState({
    name: prefill.name, email: prefill.email, phone: prefill.phone,
    billing: "", shipping: "", sameAsBilling: true,
    gstin: prefill.gstin, wantGst: prefill.isBusiness || !!prefill.gstin,
    payment: "cod",
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  const gst = useMemo(() => ({ base: exGst(total), tax: gstPart(total) }), [total]);

  const orderInput = () => ({
    name: f.name, email: f.email, phone: f.phone,
    billing_address: f.billing,
    shipping_address: f.sameAsBilling ? f.billing : f.shipping,
    gstin: f.wantGst ? f.gstin : undefined,
    payment_method: f.payment,
    items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
  });

  const submit = () =>
    start(async () => {
      setErr(null);
      const input = orderInput();

      // Pay on delivery — one server round-trip.
      if (f.payment !== "online") {
        const res = await placeOrder(input);
        if (res.ok) { clear(); setDone({ orderId: res.orderId, total: res.total }); }
        else setErr(res.error);
        return;
      }

      // Pay online — create a Razorpay order, open the modal, verify, then persist.
      const started = await startOnlinePayment(input);
      if (!started.ok) { setErr(started.error); return; }
      let payment;
      try {
        payment = await openRazorpay({
          keyId: started.keyId, amount: started.amount, razorpayOrderId: started.razorpayOrderId,
          name: started.name, email: started.email, phone: started.phone,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Payment window failed to open."); return;
      }
      if (!payment) { setErr("Payment cancelled — you weren't charged."); return; }

      const res = await confirmOnlinePayment(input, {
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
          <h1 style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, margin: "0 0 6px" }}>Order placed</h1>
          <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 4px" }}>Order <b>{done.orderId}</b> · {fmt(done.total)}</p>
          <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 20px" }}>We&apos;ve got it — a confirmation is on its way to {f.email}. Pan-India delivery in 3–7 working days.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href={`/track?order=${encodeURIComponent(done.orderId)}&email=${encodeURIComponent(f.email)}`} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Track order</Link>
            <Link href="/catalogue" style={{ background: "#EEF0FE", color: "#4E5BDC", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Continue shopping</Link>
          </div>
        </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Contact */}
          <Section title="Contact">
            <Row>
              <Field label="Full name"><input value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></Field>
              <Field label="Phone"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" style={inp} /></Field>
            </Row>
            <Field label="Email"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} style={inp} /></Field>
          </Section>

          {/* Addresses */}
          <Section title="Billing address">
            <textarea value={f.billing} onChange={(e) => set("billing", e.target.value)} rows={3} placeholder="Flat / building, street, area, city, state, PIN" style={{ ...inp, width: "100%", resize: "vertical" }} />
            <label style={ck}><input type="checkbox" checked={f.sameAsBilling} onChange={(e) => set("sameAsBilling", e.target.checked)} /> Shipping address same as billing</label>
          </Section>
          {!f.sameAsBilling && (
            <Section title="Shipping address">
              <textarea value={f.shipping} onChange={(e) => set("shipping", e.target.value)} rows={3} placeholder="Delivery address" style={{ ...inp, width: "100%", resize: "vertical" }} />
            </Section>
          )}

          {/* GST (optional) */}
          <Section title="GST invoice (optional)">
            <label style={ck}><input type="checkbox" checked={f.wantGst} onChange={(e) => set("wantGst", e.target.checked)} /> I want a GST invoice</label>
            {f.wantGst && <Field label="GSTIN"><input value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15} placeholder="27AAACE1234F1Z5" style={{ ...inp, fontFamily: "var(--space-mono)" }} /></Field>}
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <label style={{ ...payOpt, borderColor: f.payment === "cod" ? "#4E5BDC" : "#E8EBF1", background: f.payment === "cod" ? "#F7F8FF" : "#fff" }}>
              <input type="radio" name="pay" checked={f.payment === "cod"} onChange={() => set("payment", "cod")} />
              <span><b>Pay on delivery</b><br /><span style={{ fontSize: 11.5, color: "#8A93A6" }}>Settle when goods arrive</span></span>
            </label>
            {onlineEnabled ? (
              <label style={{ ...payOpt, borderColor: f.payment === "online" ? "#4E5BDC" : "#E8EBF1", background: f.payment === "online" ? "#F7F8FF" : "#fff" }}>
                <input type="radio" name="pay" checked={f.payment === "online"} onChange={() => set("payment", "online")} />
                <span><b>Pay online</b><br /><span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking — secure Razorpay checkout</span></span>
              </label>
            ) : (
              <label style={{ ...payOpt, borderColor: "#E8EBF1", background: "#FAFBFD", cursor: "default", opacity: 0.85 }}>
                <input type="radio" name="pay" disabled />
                <span><b style={{ color: "#56627A" }}>Pay online</b> <span style={{ fontSize: 10, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FD", padding: "2px 7px", borderRadius: 10, textTransform: "uppercase" }}>Coming soon</span><br /><span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking — secure Elume checkout</span></span>
              </label>
            )}
          </Section>
        </div>

        {/* Order summary */}
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "18px 20px", position: "sticky", top: 84 }}>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Order summary</div>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 7 }}>
              <span style={{ color: "#56627A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.qty}× {it.name}</span>
              <span style={{ fontFamily: GROTESK, fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10 }}>
            {f.wantGst && (
              <>
                <SumRow label="Taxable value" value={fmt(gst.base)} muted />
                <SumRow label={`GST ${Math.round(GST_RATE * 100)}%`} value={fmt(gst.tax)} muted />
              </>
            )}
            <SumRow label="Delivery" value="Free" green />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST</span></span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(total)}</span>
            </div>
          </div>
          {err && <div style={{ fontSize: 12.5, color: "#C0392B", fontWeight: 600, marginTop: 10 }}>{err}</div>}
          <button onClick={submit} disabled={pending} style={{ width: "100%", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: 13, borderRadius: 11, cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
            {pending ? (f.payment === "online" ? "Opening payment…" : "Placing order…") : `${f.payment === "online" ? "Pay" : "Place order"} · ${fmt(total)}`}
          </button>
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
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11.5, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function SumRow({ label, value, muted, green }: { label: string; value: string; muted?: boolean; green?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: muted ? "#8A93A6" : "#56627A" }}><span>{label}</span><span style={{ fontFamily: "var(--space-grotesk)", color: green ? "#1F9D63" : "#19202E", fontWeight: 600 }}>{value}</span></div>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", background: "#fff" };
const ck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358" };
const payOpt: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, border: "1.5px solid #E8EBF1", borderRadius: 11, padding: "12px 13px", cursor: "pointer", fontSize: 13.5 };
