"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { startMetalsBooking, confirmMetalsBooking, type MetalsBank } from "../actions";
import { openRazorpay } from "@/lib/razorpay-checkout";
import { lotKg } from "@/lib/metals";
import { fmt } from "@/lib/format";
import { GROTESK } from "@/lib/fonts";
import { track } from "@/lib/analytics";

/**
 * The copper booking form: pick lots, see the full money breakdown (rate/kg,
 * total, 5% token due now, RTGS balance), pay the token via Razorpay. The
 * server re-prices everything; this UI is presentation only.
 */
const TOKEN_PCT = 0.05;
const MAX_LOTS = 10;

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16 };
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#56627A", display: "block", margin: "0 0 6px" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 10, padding: "11px 13px", fontSize: 14, outline: "none", background: "#fff", fontFamily: "inherit" };

type BookingProduct = {
  id: string;
  name: string;
  lot: string | null;
  attrs: Record<string, string> | null;
  unit: string;
  price: number; // GST-inclusive per lot
  gstRate: number;
  image: string | null;
};

export default function BookingClient({
  product,
  buyer,
  online,
  bank,
}: {
  product: BookingProduct;
  buyer: { name: string; company: string; gstin: string; email: string; phone: string };
  online: boolean;
  bank: MetalsBank | null;
}) {
  const [lots, setLots] = useState(1);
  const [phone, setPhone] = useState(buyer.phone);
  const [address, setAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ orderId: string } | null>(null);
  const [pending, start] = useTransition();

  const kg = lotKg(product.attrs);
  const ratePerKg = product.price / (1 + product.gstRate) / kg;
  const m = useMemo(() => {
    const total = Math.round(product.price * lots * 100) / 100;
    const base = Math.round((total / (1 + product.gstRate)) * 100) / 100;
    const token = Math.round(total * TOKEN_PCT * 100) / 100;
    return { total, base, gst: Math.round((total - base) * 100) / 100, token, balance: Math.round((total - token) * 100) / 100 };
  }, [lots, product.price, product.gstRate]);

  function book() {
    setErr(null);
    start(async () => {
      const res = await startMetalsBooking({ productId: product.id, lots, phone, shipping_address: address });
      if (!res.ok) { setErr(res.error); return; }
      track("metals_book_start", { detail: { pid: product.id, lots } });
      const paid = await openRazorpay({
        keyId: res.keyId,
        amount: res.amount,
        razorpayOrderId: res.razorpayOrderId,
        name: res.name,
        email: res.email,
        phone: res.phone,
        orderId: res.orderId,
      });
      if (!paid) { setErr("Payment window closed before the token was paid. Your booking isn't confirmed - try again whenever you're ready."); return; }
      const confirmed = await confirmMetalsBooking({ orderId: res.orderId, ...paid });
      if (!confirmed.ok) { setErr(confirmed.error); return; }
      track("metals_book_paid", { detail: { pid: product.id, lots } });
      setDone({ orderId: confirmed.orderId });
    });
  }

  if (done) {
    return (
      <main style={{ maxWidth: 620, margin: "0 auto", padding: "50px 30px 80px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 42 }}>🔒</div>
          <h1 style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 600, letterSpacing: "-0.6px", margin: "14px 0 8px", color: "#19202E" }}>
            Rate locked - booking {done.orderId} confirmed
          </h1>
          <p style={{ fontSize: 14.5, color: "#56627A", lineHeight: 1.6, margin: "0 0 24px" }}>
            Your token of <b>{fmt(m.token)}</b> is received and a confirmation email is on its way to {buyer.email}.
            The balance of <b>{fmt(m.balance)}</b> settles by RTGS within 2 working days; dispatch follows with a full GST invoice.
          </p>
        </div>
        <div style={{ ...card, padding: "20px 24px" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E", marginBottom: 10 }}>RTGS details for the balance</div>
          {bank ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <tbody>
                {[["Account name", bank.account_name], ["Account number", bank.account_number], ["IFSC", bank.ifsc], ["Bank", [bank.bank, bank.branch].filter(Boolean).join(" · ")]].map(([k, v]) =>
                  v ? (
                    <tr key={k as string}>
                      <td style={{ padding: "7px 0", color: "#56627A" }}>{k}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700, fontFamily: "var(--space-mono)" }}>{v}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 13.5, color: "#56627A", margin: 0, lineHeight: 1.55 }}>
              Bank details arrive in your confirmation email shortly (they're also being finalised in admin). Quote booking id <b>{done.orderId}</b> as the RTGS remark.
            </p>
          )}
          {bank?.note && <p style={{ fontSize: 12, color: "#8A93A6", margin: "10px 0 0" }}>{bank.note}</p>}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 22 }}>
          <Link href="/track" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "11px 20px", borderRadius: 10 }}>Track my booking →</Link>
          <Link href="/metals" style={{ background: "#fff", border: "1.5px solid #E0E4ED", color: "#19202E", fontWeight: 700, fontSize: 13.5, padding: "11px 20px", borderRadius: 10 }}>Back to Metals</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 940, margin: "0 auto", padding: "30px 30px 80px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Copper booking</div>
      <h1 style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 600, letterSpacing: "-0.7px", margin: "6px 0 4px", color: "#19202E" }}>
        {product.name}{product.lot ? ` · ${product.lot} lot` : ""}
      </h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 22px" }}>
        Today's rate <b>₹{ratePerKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/kg ex-GST</b> · locked the moment your token is paid.
      </p>

      <div className="metals-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 18, alignItems: "start" }}>
        {/* left: form */}
        <div style={{ ...card, padding: "24px 26px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={label}>Quantity ({product.lot} lots of {kg.toLocaleString("en-IN")} kg)</label>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #E8EBF1", borderRadius: 11, overflow: "hidden", width: "fit-content" }}>
              <button onClick={() => setLots(Math.max(1, lots - 1))} style={{ width: 44, height: 46, border: "none", background: "#fff", cursor: "pointer", color: "#56627A", fontSize: 20 }}>−</button>
              <span style={{ width: 56, textAlign: "center", fontFamily: GROTESK, fontSize: 16, fontWeight: 600 }}>{lots}</span>
              <button onClick={() => setLots(Math.min(MAX_LOTS, lots + 1))} style={{ width: 44, height: 46, border: "none", background: "#fff", cursor: "pointer", color: "#56627A", fontSize: 20 }}>+</button>
            </div>
            <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 6 }}>= {(kg * lots).toLocaleString("en-IN")} kg of copper · need more than {MAX_LOTS} lots? <Link href="/metals/enquiry?metal=Copper" style={{ color: "#4E5BDC", fontWeight: 600 }}>Raise a bulk enquiry</Link></div>
          </div>

          <div style={{ background: "#F7F8FB", border: "1px solid #F0F2F6", borderRadius: 11, padding: "12px 15px", fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: "#19202E", marginBottom: 4 }}>{buyer.company || buyer.name}</div>
            <div style={{ color: "#56627A" }}>GSTIN <span style={{ fontFamily: "var(--space-mono)" }}>{buyer.gstin}</span> · {buyer.email}</div>
          </div>

          <div>
            <label style={label}>Mobile number</label>
            <input style={inp} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxxxxx00" inputMode="tel" />
          </div>
          <div>
            <label style={label}>Delivery address (site / works)</label>
            <textarea
              style={{ ...inp, minHeight: 96, resize: "vertical", lineHeight: 1.55 }}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Plant / site address with city, state and PIN…"
            />
          </div>

          {err && (
            <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "10px 13px", fontSize: 13 }}>{err}</div>
          )}

          {online ? (
            <button
              onClick={book}
              disabled={pending}
              style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", padding: "14px 22px", borderRadius: 11, cursor: "pointer", opacity: pending ? 0.7 : 1 }}
            >
              {pending ? "Opening secure payment…" : `Pay ${fmt(m.token)} token · lock today's rate`}
            </button>
          ) : (
            <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 11, padding: "13px 16px", fontSize: 13.5, color: "#56627A" }}>
              Online token payment is being enabled. Meanwhile, <Link href="/metals/enquiry?metal=Copper" style={{ color: "#4E5BDC", fontWeight: 700 }}>raise an enquiry</Link> and we'll book you over email.
            </div>
          )}
          <p style={{ fontSize: 11.5, color: "#8A93A6", margin: 0, lineHeight: 1.55 }}>
            5% token via Razorpay · balance {fmt(m.balance)} by RTGS within 2 working days · dispatch with GST tax invoice after full payment. If the balance isn't received in time the booking may be released and the token refunded at our discretion.
          </p>
        </div>

        {/* right: money summary */}
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 12 }}>Booking summary</div>
          {[
            [`Rate`, `₹${ratePerKg.toLocaleString("en-IN", { maximumFractionDigits: 2 })}/kg ex-GST`],
            [`${lots} × ${product.lot} lot (${(kg * lots).toLocaleString("en-IN")} kg)`, fmt(m.base) + " ex-GST"],
            [`GST @ ${Math.round(product.gstRate * 100)}%`, fmt(m.gst)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid #F5F6F9", fontSize: 13.5 }}>
              <span style={{ color: "#56627A" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "#19202E" }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0", fontSize: 15 }}>
            <span style={{ fontWeight: 700, color: "#19202E" }}>Order total</span>
            <span style={{ fontFamily: GROTESK, fontWeight: 700, color: "#19202E" }}>{fmt(m.total)}</span>
          </div>
          <div style={{ background: "#EEF0FD", border: "1px solid #DFE3FB", borderRadius: 11, padding: "13px 16px", marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700, color: "#232B6E" }}>
              <span>Token due now (5%)</span><span>{fmt(m.token)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#56627A", marginTop: 5 }}>
              <span>Balance by RTGS</span><span>{fmt(m.balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
