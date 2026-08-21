"use client";

import { useEffect, useState } from "react";
import { MONO, GROTESK } from "@/lib/fonts";

/**
 * Quotation builder (admin): enquiry email + RFQ products in, editable Word
 * quotation out. Every price field here is EXCLUSIVE of GST: the docx shows
 * manufacturer MRP (ex-GST) vs Elume price (ex-GST) with the discount
 * computed between them, and GST lands once at the bottom.
 */

type Item = {
  productId: string | null; description: string; catNo?: string; code?: string;
  qty: number; unit: string; mrpEx: number; priceEx: number; confidence?: number;
};

const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13, outline: "none", background: "#fff" };
const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: "#56627A", display: "block", marginBottom: 5 };

function fyLabel(d = new Date()): string {
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
}

export default function QuotationBuilder() {
  const [company, setCompany] = useState("");
  const [address, setAddress] = useState("");
  const [attn, setAttn] = useState("");
  const [email, setEmail] = useState("");
  const [rfqNo, setRfqNo] = useState("");
  const [rfqDate, setRfqDate] = useState("");
  const [subject, setSubject] = useState("");
  const [ref, setRef] = useState(`EQ/${fyLabel()}/`);
  const [gstPct, setGstPct] = useState(18);
  const [intraState, setIntraState] = useState(false);
  const [bestOffer, setBestOffer] = useState(true);
  const [terms, setTerms] = useState<Record<string, string>>({
    Delivery: "Within 10 days of confirmed order with payment.",
    Freight: "Freight/transport charges are extra at actuals. Quoted prices are ex-freight.",
    Payment: "100% advance along with the purchase order.",
    Warranty: "As per the manufacturer's standard warranty for the quoted product.",
    Validity: "This quotation is valid for 15 days from the date above.",
  });
  const [paste, setPaste] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<"resolve" | "docx" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Smart BOM hand-off: /admin/quotation?items=id:qty,... hydrates the table.
  useEffect(() => {
    const ids = new URLSearchParams(window.location.search).get("items");
    if (!ids) return;
    fetch("/api/admin/boq/quotation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resolve", ids }) })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setItems(d.items); })
      .catch(() => {});
  }, []);

  const resolve = async () => {
    setBusy("resolve"); setErr(null);
    try {
      const r = await fetch("/api/admin/boq/quotation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "resolve", text: paste }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Could not resolve the lines.");
      setItems((prev) => [...prev, ...d.items]);
      setPaste("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(null); }
  };

  const upd = (i: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const taxable = items.reduce((s, it) => s + it.qty * it.priceEx, 0);
  const grand = taxable * (1 + gstPct / 100);
  const inr = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const download = async () => {
    setBusy("docx"); setErr(null);
    try {
      const payload = {
        ref: ref.trim(), dateLabel: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        company: company.trim(), address: address.trim() || undefined, attn: attn.trim() || undefined, email: email.trim() || undefined,
        rfqNo: rfqNo.trim() || undefined, rfqDate: rfqDate.trim() || undefined, subject: subject.trim(),
        gstRate: gstPct / 100, intraState, bestOffer, terms,
        items: items.filter((it) => it.description.trim() && it.priceEx > 0),
      };
      const r = await fetch("/api/admin/boq/quotation", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "docx", payload }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || "Could not build the document.");
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `Elume-Quotation-${ref.replace(/[^\w-]+/g, "-")}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed."); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 22px 80px", fontFamily: "var(--hanken)" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: "#1D2F8A", marginBottom: 8 }}>
        Smart BOM · quotation export
      </div>
      <h1 style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Build a quotation (.docx)</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 22px", maxWidth: 720 }}>
        Enter the enquiry details, paste the RFQ lines (or arrive from the Smart BOM console with lines approved),
        adjust prices, download Word, edit if needed, then print to PDF. Every price below is EXCLUSIVE of GST.
      </p>

      {/* ── Enquiry details ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><span style={label}>Company *</span><input style={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="C E Comfort Engineers Pvt Ltd" /></div>
            <div><span style={label}>Customer email</span><input style={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="buyer@company.in" /></div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><span style={label}>Address</span><input style={field} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><span style={label}>Kind attention</span><input style={field} value={attn} onChange={(e) => setAttn(e.target.value)} placeholder="Mr. ..." /></div>
          <div><span style={label}>RFQ no.</span><input style={field} value={rfqNo} onChange={(e) => setRfqNo(e.target.value)} /></div>
          <div><span style={label}>RFQ date</span><input style={field} value={rfqDate} onChange={(e) => setRfqDate(e.target.value)} placeholder="13-08-2026" /></div>
          <div style={{ gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div><span style={label}>Subject *</span><input style={field} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quotation for ..." /></div>
            <div><span style={label}>Our ref</span><input style={field} value={ref} onChange={(e) => setRef(e.target.value)} /></div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, alignItems: "center", marginTop: 14, fontSize: 13 }}>
          <label style={{ display: "flex", gap: 7, alignItems: "center" }}>GST %
            <input type="number" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value) || 18)} style={{ ...field, width: 70 }} />
          </label>
          <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={intraState} onChange={(e) => setIntraState(e.target.checked)} style={{ accentColor: "#1D2F8A" }} />
            Intra-state (CGST + SGST split)
          </label>
          <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={bestOffer} onChange={(e) => setBestOffer(e.target.checked)} style={{ accentColor: "#1D2F8A" }} />
            Print &ldquo;This is our best offer.&rdquo;
          </label>
        </div>
      </section>

      {/* ── RFQ lines in ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
        <span style={label}>Paste the RFQ product lines (free text or CSV, one product per line)</span>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"Havells Swing HS wall fan 400mm black - 34 nos\nPolycab 2.5 sqmm FR red - 40 coils"} style={{ ...field, minHeight: 84, resize: "vertical", fontFamily: "var(--space-mono)", fontSize: 12.5 }} />
        <button onClick={resolve} disabled={!paste.trim() || busy === "resolve"} style={{ marginTop: 10, background: paste.trim() ? "#1D2F8A" : "#C9CFDD", color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 9, border: "none", cursor: paste.trim() ? "pointer" : "default" }}>
          {busy === "resolve" ? "Matching…" : "Resolve against catalogue"}
        </button>
      </section>

      {/* ── Items table ── */}
      {items.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#56627A" }}>
                {["Description", "Cat. no.", "Qty", "Unit", "MRP ex-GST", "Price ex-GST", "Disc.", ""].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid #E8EBF1", fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} style={{ background: it.productId ? undefined : "#FFF7F0" }}>
                  <td style={{ padding: "5px 8px", minWidth: 260 }}><input style={{ ...field, padding: "6px 8px" }} value={it.description} onChange={(e) => upd(i, { description: e.target.value })} /></td>
                  <td style={{ padding: "5px 8px" }}><input style={{ ...field, padding: "6px 8px", width: 130 }} value={it.catNo ?? ""} onChange={(e) => upd(i, { catNo: e.target.value })} /></td>
                  <td style={{ padding: "5px 8px" }}><input type="number" style={{ ...field, padding: "6px 8px", width: 64 }} value={it.qty} onChange={(e) => upd(i, { qty: Math.max(1, Number(e.target.value) || 1) })} /></td>
                  <td style={{ padding: "5px 8px" }}><input style={{ ...field, padding: "6px 8px", width: 62 }} value={it.unit} onChange={(e) => upd(i, { unit: e.target.value })} /></td>
                  <td style={{ padding: "5px 8px" }}><input type="number" style={{ ...field, padding: "6px 8px", width: 100 }} value={it.mrpEx} onChange={(e) => upd(i, { mrpEx: Number(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "5px 8px" }}><input type="number" style={{ ...field, padding: "6px 8px", width: 100 }} value={it.priceEx} onChange={(e) => upd(i, { priceEx: Number(e.target.value) || 0 })} /></td>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 700, color: "#1F9D63" }}>{it.mrpEx > 0 ? `${Math.round((1 - it.priceEx / it.mrpEx) * 100)}%` : "-"}</td>
                  <td style={{ padding: "5px 8px" }}><button onClick={() => setItems((p) => p.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: "#C0392B", cursor: "pointer", fontSize: 15 }}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => setItems((p) => [...p, { productId: null, description: "", qty: 1, unit: "Nos", mrpEx: 0, priceEx: 0 }])} style={{ marginTop: 10, border: "1px dashed #C9CFDD", background: "none", color: "#56627A", fontSize: 12.5, fontWeight: 600, padding: "7px 14px", borderRadius: 9, cursor: "pointer" }}>
            + Add a line manually
          </button>
          <div style={{ marginTop: 14, fontSize: 13.5, color: "#3A4358" }}>
            Taxable (ex-GST): <b>₹{inr(taxable)}</b> · GST @ {gstPct}%: <b>₹{inr(taxable * gstPct / 100)}</b> · Grand total: <b>₹{inr(grand)}</b>
          </div>
        </section>
      )}

      {/* ── Terms ── */}
      <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 12 }}>Terms &amp; conditions</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {Object.entries(terms).map(([k, v]) => (
            <div key={k}><span style={label}>{k}</span><input style={field} value={v} onChange={(e) => setTerms((t) => ({ ...t, [k]: e.target.value }))} /></div>
          ))}
        </div>
      </section>

      {err && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: 12 }}>{err}</p>}
      <button onClick={download} disabled={!company.trim() || !subject.trim() || items.length === 0 || busy === "docx"}
        style={{ background: company.trim() && subject.trim() && items.length ? "#1D2F8A" : "#C9CFDD", color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "12px 26px", borderRadius: 11, border: "none", cursor: "pointer" }}>
        {busy === "docx" ? "Building…" : "Download quotation (.docx)"}
      </button>
    </div>
  );
}
