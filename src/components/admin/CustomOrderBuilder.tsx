"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Custom order builder (admin). Lines can come from the catalogue (search,
 * then override the price if needed) or be fully custom (name, HSN, GST %,
 * ex-GST unit price). Prices are entered EX-GST; the order stores GST-
 * inclusive prices exactly like web checkout so invoices stay correct.
 */

type Line = { kind: "catalogue" | "custom"; id?: string; name: string; qty: number; unit: string; priceEx: number; gstRate: number; hsn: string; cat: string; note: string; listPriceIncl?: number };
type Suggest = { id: string; name: string; brand?: string; price?: number; cat?: string; gstRate?: number; hsn?: string; unit?: string };

const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13, outline: "none", background: "#fff" };
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "#56627A", display: "block", marginBottom: 5 };
const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomOrderBuilder() {
  const router = useRouter();
  const [cust, setCust] = useState({ name: "", email: "", phone: "", gstin: "", billingAddress: "", shippingAddress: "" });
  const [sameAddr, setSameAddr] = useState(true);
  const [lines, setLines] = useState<Line[]>([]);
  const [q, setQ] = useState("");
  const [sugg, setSugg] = useState<Suggest[]>([]);
  const [shippingFee, setShippingFee] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "cod" | "neft" | "upi" | "cash" | "credit">("upi");
  const [paid, setPaid] = useState(true);
  const [status, setStatus] = useState<"confirmed" | "placed" | "packed">("confirmed");
  const [source, setSource] = useState("phone");
  const [note, setNote] = useState("");
  const [emailCustomer, setEmailCustomer] = useState(false);
  const [busy, setBusy] = useState<"link" | "record" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [expiresDays, setExpiresDays] = useState(14);
  const [standardShipping, setStandardShipping] = useState(true);
  const [emailLink, setEmailLink] = useState(true);
  const [link, setLink] = useState<{ url: string; token: string; expiresAt: string; emailed: boolean } | null>(null);
  const [recent, setRecent] = useState<{ token: string; url: string; created_at: string; expires_at: string; status: string; customer: { name?: string; email?: string; phone?: string }; lines: number; total: number; source: string | null; converted_order_id: string | null }[]>([]);
  const loadRecent = () => fetch("/api/admin/orders/custom").then((r) => r.json()).then((d) => { if (d.ok) setRecent(d.links); }).catch(() => {});
  useEffect(() => { loadRecent(); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Catalogue search (debounced) through the public suggest endpoint.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setSugg([]); return; }
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setSugg((d.products ?? []).slice(0, 8));
      } catch { setSugg([]); }
    }, 250);
  }, [q]);

  const addCatalogue = (p: Suggest) => {
    const rate = p.gstRate ?? 0.18;
    const priceEx = p.price ? Math.round((p.price / (1 + rate)) * 100) / 100 : 0;
    setLines((ls) => [...ls, { kind: "catalogue", id: p.id, name: p.name, qty: 1, unit: p.unit || "pc", priceEx, gstRate: rate, hsn: p.hsn || "", cat: p.cat || "", note: "", listPriceIncl: p.price }]);
    setQ(""); setSugg([]);
  };
  const addCustom = () => setLines((ls) => [...ls, { kind: "custom", name: "", qty: 1, unit: "pc", priceEx: 0, gstRate: 0.18, hsn: "", cat: "Custom", note: "" }]);
  const upd = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const goodsEx = lines.reduce((s, l) => s + l.priceEx * l.qty, 0);
  const goodsIncl = lines.reduce((s, l) => s + l.priceEx * (1 + l.gstRate) * l.qty, 0);
  const gst = goodsIncl - goodsEx;
  const total = Math.max(0, goodsIncl - discount) + (standardShipping ? 0 : shippingFee);

  const linesPayload = () => lines.map((l) => ({ kind: l.kind, id: l.id, name: l.name, qty: l.qty, unit: l.unit, priceEx: l.priceEx, gstRate: l.gstRate, hsn: l.hsn, cat: l.cat, note: l.note }));
  const customerPayload = () => ({ ...cust, shippingAddress: sameAddr ? cust.billingAddress : cust.shippingAddress });

  /** Primary path: create a payment link the customer completes themselves. */
  const createLink = async () => {
    setBusy("link"); setErr(null);
    try {
      const r = await fetch("/api/admin/orders/custom", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer: customerPayload(), items: linesPayload(), shippingFee: standardShipping ? null : shippingFee, discountAmount: discount, note: customerNote, adminNote: note, source, expiresDays, emailLink: emailLink && !!cust.email.trim() }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not create the link.");
      setLink({ url: d.url, token: d.token, expiresAt: d.expiresAt, emailed: d.emailed });
      loadRecent();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(null); }
  };

  /** Secondary path: the customer already paid offline; record it directly. */
  const recordPaid = async () => {
    setBusy("record"); setErr(null);
    try {
      const r = await fetch("/api/admin/orders/create", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ customer: customerPayload(), items: linesPayload(), shippingFee, discountAmount: discount, paymentMethod, paid, status, source, adminNote: note, emailCustomer }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not create the order.");
      router.push(`/admin/orders/${d.orderId}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); setBusy(null); }
  };

  const linesOk = lines.length > 0 && lines.every((l) => l.name.trim() && l.priceEx > 0 && l.qty > 0);
  const canLink = linesOk;                       // a link can go out before we know every detail
  const canRecord = linesOk && !!cust.name.trim() && !!cust.email.trim() && !!cust.phone.trim() && !!cust.billingAddress.trim();
  const waText = encodeURIComponent(`Hi${cust.name ? ` ${cust.name}` : ""}, your Elume order is ready. Review and pay here: ${link?.url ?? ""}`);
  const waHref = `https://wa.me/${cust.phone.replace(/\D/g, "")}?text=${waText}`;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 22px 80px", fontFamily: "var(--hanken)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Create a custom order</h1>
          <p style={{ fontSize: 13, color: "#56627A", margin: "4px 0 0" }}>Prepare the items and your price; the customer completes details and payment through a link (same checkout as the website, prefilled for signed-in buyers). Already paid offline? Record it directly instead. Prices are entered ex-GST.</p>
        </div>
        <Link href="/admin/orders" style={{ fontSize: 13, color: "#8A93A6" }}>← All orders</Link>
      </div>

      {link && (
        <section style={{ background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 14, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#166A44", marginBottom: 6 }}>Payment link ready{link.emailed ? " · emailed to the customer" : ""}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: 12.5, background: "#fff", border: "1px solid #BEE7D2", borderRadius: 8, padding: "7px 10px" }}>{link.url}</code>
            <button onClick={() => navigator.clipboard?.writeText(link.url)} style={{ border: "1px solid #1F9D63", background: "#fff", color: "#166A44", fontSize: 12.5, fontWeight: 700, padding: "7px 12px", borderRadius: 8, cursor: "pointer" }}>Copy link</button>
            {cust.phone.trim() && <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ background: "#1F9D63", color: "#fff", fontSize: 12.5, fontWeight: 700, padding: "8px 12px", borderRadius: 8 }}>Send on WhatsApp</a>}
            <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 700, color: "#166A44" }}>Preview as the customer →</a>
          </div>
          <div style={{ fontSize: 12, color: "#166A44", marginTop: 8 }}>Valid until {new Date(link.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}. The link becomes an order the moment the customer pays; it then shows in Orders like any web order.</div>
        </section>
      )}

      {/* ── Customer ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 4 }}>Customer</div>
        <p style={{ fontSize: 12, color: "#8A93A6", margin: "0 0 12px" }}>For a payment link everything here is optional prefill (the customer confirms it). To record an offline-paid order, name, email, phone and billing address are required.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
          <div><span style={label}>Name</span><input style={field} value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} /></div>
          <div><span style={label}>Email</span><input style={field} value={cust.email} onChange={(e) => setCust({ ...cust, email: e.target.value })} placeholder="for invoice and updates" /></div>
          <div><span style={label}>Phone</span><input style={field} value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} placeholder="+91 98xxxxxxxx" /></div>
          <div><span style={label}>GSTIN</span><input style={field} value={cust.gstin} onChange={(e) => setCust({ ...cust, gstin: e.target.value.toUpperCase() })} placeholder="optional" /></div>
          <div style={{ gridColumn: "1 / 3" }}><span style={label}>Billing address</span><textarea style={{ ...field, minHeight: 62, resize: "vertical" }} value={cust.billingAddress} onChange={(e) => setCust({ ...cust, billingAddress: e.target.value })} placeholder="Line, city, state - PIN" /></div>
          <div style={{ gridColumn: "3 / 5" }}>
            <span style={label}>Shipping address <label style={{ fontWeight: 500, marginLeft: 8, cursor: "pointer" }}><input type="checkbox" checked={sameAddr} onChange={(e) => setSameAddr(e.target.checked)} style={{ accentColor: "#1D2F8A" }} /> same as billing</label></span>
            <textarea style={{ ...field, minHeight: 62, resize: "vertical", opacity: sameAddr ? 0.5 : 1 }} disabled={sameAddr} value={sameAddr ? cust.billingAddress : cust.shippingAddress} onChange={(e) => setCust({ ...cust, shippingAddress: e.target.value })} />
          </div>
        </div>
      </section>

      {/* ── Lines ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 12 }}>Items</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12, position: "relative" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <input style={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalogue to add a listed product (you can still change its price)…" />
            {sugg.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E0E4ED", borderRadius: 10, marginTop: 4, zIndex: 10, boxShadow: "0 10px 30px rgba(20,24,45,0.12)", maxHeight: 320, overflowY: "auto" }}>
                {sugg.map((p) => (
                  <button key={p.id} onClick={() => addCatalogue(p)} style={{ display: "flex", justifyContent: "space-between", gap: 10, width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: "1px solid #F0F2F6", padding: "9px 12px", cursor: "pointer", fontSize: 13 }}>
                    <span style={{ color: "#19202E" }}>{p.name}</span>
                    <span style={{ color: "#8A93A6", whiteSpace: "nowrap" }}>{p.price ? `₹${inr(p.price)} incl.` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={addCustom} style={{ border: "1px dashed #1D2F8A", background: "#E9EDF9", color: "#1D2F8A", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" }}>+ Custom product</button>
        </div>
        {lines.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr style={{ textAlign: "left", color: "#56627A" }}>
                {["Product", "HSN", "Qty", "Unit", "Unit price ex-GST", "GST %", "Line incl. GST", ""].map((h) => <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #E8EBF1", fontSize: 11 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} style={{ background: l.kind === "custom" ? "#FFF7F0" : undefined }}>
                    <td style={{ padding: "5px 8px", minWidth: 280 }}>
                      <input style={{ ...field, padding: "6px 8px" }} value={l.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder={l.kind === "custom" ? "Describe the product exactly as it should appear on the invoice" : ""} readOnly={l.kind === "catalogue"} />
                      {l.kind === "catalogue" && l.listPriceIncl ? <div style={{ fontSize: 10.5, color: "#8A93A6", marginTop: 2 }}>catalogue price ₹{inr(l.listPriceIncl)} incl. · your price applies</div> : null}
                      {l.kind === "custom" && <input style={{ ...field, padding: "5px 8px", marginTop: 4, fontSize: 11.5 }} value={l.note} onChange={(e) => upd(i, { note: e.target.value })} placeholder="internal note: customisation, supplier, lead time (optional)" />}
                    </td>
                    <td style={{ padding: "5px 8px" }}><input style={{ ...field, padding: "6px 8px", width: 80 }} value={l.hsn} onChange={(e) => upd(i, { hsn: e.target.value })} /></td>
                    <td style={{ padding: "5px 8px" }}><input type="number" min={1} style={{ ...field, padding: "6px 8px", width: 64 }} value={l.qty} onChange={(e) => upd(i, { qty: Math.max(1, Number(e.target.value) || 1) })} /></td>
                    <td style={{ padding: "5px 8px" }}><input style={{ ...field, padding: "6px 8px", width: 64 }} value={l.unit} onChange={(e) => upd(i, { unit: e.target.value })} /></td>
                    <td style={{ padding: "5px 8px" }}><input type="number" min={0} step="0.01" style={{ ...field, padding: "6px 8px", width: 110 }} value={l.priceEx} onChange={(e) => upd(i, { priceEx: Number(e.target.value) || 0 })} /></td>
                    <td style={{ padding: "5px 8px" }}>
                      <select style={{ ...field, padding: "6px 8px", width: 78 }} value={l.gstRate} onChange={(e) => upd(i, { gstRate: Number(e.target.value) })}>
                        {[0, 0.05, 0.12, 0.18, 0.28].map((r) => <option key={r} value={r}>{Math.round(r * 100)}%</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 700 }}>₹{inr(l.priceEx * (1 + l.gstRate) * l.qty)}</td>
                    <td style={{ padding: "5px 8px" }}><button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#C0392B", cursor: "pointer", fontSize: 15 }}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lines.length === 0 && <p style={{ fontSize: 13, color: "#8A93A6", margin: 0 }}>No items yet. Search the catalogue or add a custom product.</p>}
      </section>

      {/* ── Charges, payment, status ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 22 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 12 }}>Payment and status</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><span style={label}>Payment method</span>
              <select style={field} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="upi">UPI</option><option value="neft">NEFT / RTGS</option><option value="cash">Cash</option><option value="cod">Cash on delivery</option><option value="online">Online (payment link)</option><option value="credit">Credit terms</option>
              </select></div>
            <div><span style={label}>Order status</span>
              <select style={field} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="confirmed">Confirmed</option><option value="placed">Placed (awaiting confirmation)</option><option value="packed">Packed</option>
              </select></div>
            <div><span style={label}>Source</span>
              <select style={field} value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="walk-in">Walk-in</option><option value="quotation">Accepted quotation</option>
              </select></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "flex-end", paddingBottom: 6 }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} style={{ accentColor: "#1D2F8A" }} /> Payment received</label>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={emailCustomer} onChange={(e) => setEmailCustomer(e.target.checked)} style={{ accentColor: "#1D2F8A" }} /> Email the customer an order confirmation</label>
            </div>
            <div style={{ gridColumn: "1 / -1" }}><span style={label}>Internal note</span><input style={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. customised 25 m cut lengths, supplier confirmed 3-day lead time" /></div>
            <div style={{ gridColumn: "1 / -1" }}><span style={label}>Message shown to the customer on the link (optional)</span><input style={field} value={customerNote} onChange={(e) => setCustomerNote(e.target.value)} placeholder="e.g. As discussed on the phone: cut lengths of 25 m, dispatch within 3 working days of payment" /></div>
            <div><span style={label}>Link valid for (days)</span><input type="number" min={1} max={90} style={field} value={expiresDays} onChange={(e) => setExpiresDays(Math.min(90, Math.max(1, Number(e.target.value) || 14)))} /></div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 8 }}>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={emailLink} onChange={(e) => setEmailLink(e.target.checked)} style={{ accentColor: "#1D2F8A" }} /> Email the link to the customer</label>
            </div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 12 }}>Totals</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <span style={label}>Shipping / freight (incl. GST)</span>
              <label style={{ display: "flex", gap: 7, alignItems: "center", fontSize: 12.5, marginBottom: 6, cursor: "pointer" }}><input type="checkbox" checked={standardShipping} onChange={(e) => setStandardShipping(e.target.checked)} style={{ accentColor: "#1D2F8A" }} /> standard tiered delivery (free above ₹4,000)</label>
              <input type="number" min={0} style={{ ...field, opacity: standardShipping ? 0.5 : 1 }} disabled={standardShipping} value={shippingFee} onChange={(e) => setShippingFee(Number(e.target.value) || 0)} placeholder="fixed amount" />
            </div>
            <div><span style={label}>Discount (₹, on goods incl. GST)</span><input type="number" min={0} style={field} value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} /></div>
          </div>
          <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 10, padding: "12px 14px", fontSize: 13, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6 }}>
            <span style={{ color: "#56627A" }}>Goods ex-GST</span><b>₹{inr(goodsEx)}</b>
            <span style={{ color: "#56627A" }}>GST</span><b>₹{inr(gst)}</b>
            {discount > 0 && <><span style={{ color: "#56627A" }}>Discount</span><b>- ₹{inr(discount)}</b></>}
            <span style={{ color: "#56627A" }}>Shipping</span><b>{standardShipping ? "standard" : `₹${inr(shippingFee)}`}</b>
            <span style={{ fontWeight: 800, color: "#16215B", fontSize: 15, marginTop: 4 }}>Order total</span><span style={{ fontWeight: 800, color: "#16215B", fontSize: 15, marginTop: 4 }}>₹{inr(total)}</span>
          </div>
        </div>
      </section>

      {err && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: 12 }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={createLink} disabled={!canLink || !!busy} style={{ background: canLink ? "#1D2F8A" : "#C9CFDD", color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "12px 26px", borderRadius: 11, border: "none", cursor: canLink ? "pointer" : "default" }}>
          {busy === "link" ? "Creating link…" : "Create payment link for the customer"}
        </button>
        <button onClick={recordPaid} disabled={!canRecord || !!busy} title={canRecord ? "" : "Needs name, email, phone and billing address"} style={{ background: "#fff", color: canRecord ? "#16215B" : "#C9CFDD", fontSize: 14, fontWeight: 700, padding: "11px 20px", borderRadius: 11, border: `1.5px solid ${canRecord ? "#16215B" : "#E0E4ED"}`, cursor: canRecord ? "pointer" : "default" }}>
          {busy === "record" ? "Recording…" : `Record as ${paid ? "paid" : "placed"} (offline) · ₹${inr(total)}`}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#8A93A6", marginTop: 10 }}>Payment link: the customer sees these items at your prices, fills or confirms details (saved addresses and GSTINs appear for signed-in buyers) and pays by UPI, card or net banking. Offline record: the order is created immediately in the order console.</p>

      {recent.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginTop: 26 }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 10 }}>Recent payment links</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr style={{ textAlign: "left", color: "#56627A" }}>{["Created", "Customer", "Lines", "Total", "Status", "Link"].map((h) => <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #E8EBF1", fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {recent.map((r) => {
                const expired = r.status === "open" && new Date(r.expires_at).getTime() < Date.now();
                return (
                  <tr key={r.token}>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>{new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                    <td style={{ padding: "7px 8px" }}>{r.customer?.name || r.customer?.email || r.customer?.phone || "(no prefill)"}</td>
                    <td style={{ padding: "7px 8px" }}>{r.lines}</td>
                    <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>₹{inr(r.total)}</td>
                    <td style={{ padding: "7px 8px" }}>
                      {r.status === "converted" ? <Link href={`/admin/orders/${r.converted_order_id}`} style={{ color: "#1F9D63", fontWeight: 700 }}>Paid · {r.converted_order_id}</Link> : expired ? <span style={{ color: "#B4690E", fontWeight: 700 }}>Expired</span> : <span style={{ color: "#1D2F8A", fontWeight: 700 }}>Open</span>}
                    </td>
                    <td style={{ padding: "7px 8px" }}><button onClick={() => navigator.clipboard?.writeText(r.url)} style={{ border: "1px solid #E0E4ED", background: "#fff", fontSize: 11.5, padding: "4px 9px", borderRadius: 7, cursor: "pointer" }}>Copy</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
