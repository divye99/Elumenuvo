"use client";

import { useState, useTransition } from "react";

export type PromoRow = {
  id: string;
  promotion_id: string;
  long_title: string;
  offer_type: "NO_CODE" | "GENERIC_CODE";
  redemption_code: string | null;
  applicability: "ALL_PRODUCTS" | "SPECIFIC_PRODUCTS";
  item_ids: string[] | null;
  min_purchase: number | null;
  starts_at: string;
  ends_at: string;
  active: boolean;
};

const inp: React.CSSProperties = { fontSize: 13, border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 10px", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#56627A", display: "block", marginBottom: 4 };
const mini: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#1D2F8A", background: "#F3F5F9", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer" };

const istDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });

export default function PromotionsConsole({ rows, tableMissing }: { rows: PromoRow[]; tableMissing: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pid, setPid] = useState("");
  const [title, setTitle] = useState("");
  const [offerType, setOfferType] = useState<"NO_CODE" | "GENERIC_CODE">("NO_CODE");
  const [code, setCode] = useState("");
  const [applicability, setApplicability] = useState<"ALL_PRODUCTS" | "SPECIFIC_PRODUCTS">("ALL_PRODUCTS");
  const [itemIds, setItemIds] = useState("");
  const [minPurchase, setMinPurchase] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const call = (body: Record<string, unknown>) =>
    start(async () => {
      setError(null);
      const r = await fetch("/api/admin/promotions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({ ok: false, error: "Network hiccup" }));
      if (!j.ok) setError(j.error || "Failed");
      else window.location.reload();
    });

  const now = Date.now();
  const status = (p: PromoRow) => {
    if (!p.active) return { label: "OFF", bg: "#F3F5F9", fg: "#8A93A6" };
    if (new Date(p.ends_at).getTime() < now) return { label: "EXPIRED", bg: "#FDECEC", fg: "#C0392B" };
    if (new Date(p.starts_at).getTime() > now) return { label: "SCHEDULED", bg: "#E9EDF9", fg: "#1D2F8A" };
    return { label: "LIVE", bg: "#E7F6EE", fg: "#1F9D63" };
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Merchant Center promotions</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 6px", maxWidth: 760 }}>
        Promotions created here are served to Google as a self-updating feed. One-time setup in Merchant
        Center: Marketing → Promotions → add promotions from a file → enter a link, and paste:
      </p>
      <code style={{ display: "inline-block", fontSize: 12.5, background: "#F3F5F9", borderRadius: 8, padding: "7px 12px", marginBottom: 16 }}>
        https://elumenuvo.com/api/merchant-promotions
      </code>
      {tableMissing && (
        <div style={{ fontSize: 13, color: "#B7791F", background: "#FFF6ED", border: "1px solid #F5DEC4", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
          Run migration 0129 (merchant_promotions) in Supabase to activate this console.
        </div>
      )}

      {/* ── Create ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px", marginBottom: 18, display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#8A93A6", letterSpacing: "0.7px" }}>NEW PROMOTION</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <div>
            <span style={lbl}>Promotion id (stable slug)</span>
            <input value={pid} onChange={(e) => setPid(e.target.value)} placeholder="freeship-4000" style={inp} />
          </div>
          <div>
            <span style={lbl}>Title customers see (max 60 chars)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="Free pan-India delivery on orders over Rs 4,000" style={inp} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
          <div>
            <span style={lbl}>Type</span>
            <select value={offerType} onChange={(e) => setOfferType(e.target.value as any)} style={inp}>
              <option value="NO_CODE">No code needed</option>
              <option value="GENERIC_CODE">Shared code</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Shared code {offerType === "NO_CODE" ? "(n/a)" : ""}</span>
            <input value={code} onChange={(e) => setCode(e.target.value)} disabled={offerType === "NO_CODE"} placeholder="ELUMEFEST" style={{ ...inp, opacity: offerType === "NO_CODE" ? 0.5 : 1 }} />
          </div>
          <div>
            <span style={lbl}>Starts</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inp} />
          </div>
          <div>
            <span style={lbl}>Ends</span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inp} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10 }}>
          <div>
            <span style={lbl}>Applies to</span>
            <select value={applicability} onChange={(e) => setApplicability(e.target.value as any)} style={inp}>
              <option value="ALL_PRODUCTS">All products</option>
              <option value="SPECIFIC_PRODUCTS">Specific products</option>
            </select>
          </div>
          <div>
            <span style={lbl}>Min order ₹ (optional)</span>
            <input value={minPurchase} onChange={(e) => setMinPurchase(e.target.value)} inputMode="numeric" placeholder="4000" style={inp} />
          </div>
          <div>
            <span style={lbl}>Product ids {applicability === "ALL_PRODUCTS" ? "(n/a)" : "(comma or space separated)"}</span>
            <input value={itemIds} onChange={(e) => setItemIds(e.target.value)} disabled={applicability === "ALL_PRODUCTS"} placeholder="hav-dcvncspa032, poly25" style={{ ...inp, opacity: applicability === "ALL_PRODUCTS" ? 0.5 : 1 }} />
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "#8A93A6" }}>
          Shared codes are one code for everyone (e.g. ELUMEFEST). Never use the one-time ELUME10-XXXX codes here - Google shows the code publicly.
        </div>
        <button
          disabled={pending}
          onClick={() => call({ op: "create", promotionId: pid, longTitle: title, offerType, redemptionCode: code, applicability, itemIds, minPurchase, startsAt: startsAt ? `${startsAt}T00:00:00+05:30` : "", endsAt: endsAt ? `${endsAt}T23:59:59+05:30` : "" })}
          style={{ justifySelf: "start", background: pending ? "#C9CFDD" : "#1D2F8A", color: "#fff", fontSize: 13, fontWeight: 700, padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer" }}
        >
          {pending ? "Saving…" : "Create promotion"}
        </button>
        {error && <div style={{ fontSize: 13, color: "#C0392B", fontWeight: 600 }}>{error}</div>}
      </div>

      {/* ── List ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        {rows.length === 0 && <div style={{ padding: "30px 20px", textAlign: "center", color: "#8A93A6", fontSize: 13.5 }}>No promotions yet.</div>}
        {rows.map((p, i) => {
          const st = status(p);
          return (
            <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, background: st.bg, color: st.fg, borderRadius: 7, padding: "3px 9px" }}>{st.label}</span>
              <span style={{ minWidth: 280 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>{p.long_title}</span>
                <span style={{ fontSize: 11.5, color: "#8A93A6" }}>
                  {p.promotion_id} · {p.offer_type === "GENERIC_CODE" ? `code ${p.redemption_code}` : "no code"} ·{" "}
                  {p.applicability === "ALL_PRODUCTS" ? "all products" : `${p.item_ids?.length ?? 0} products`}
                  {p.min_purchase ? ` · min ₹${Math.round(Number(p.min_purchase)).toLocaleString("en-IN")}` : ""}
                </span>
              </span>
              <span style={{ fontSize: 12, color: "#56627A" }}>{istDate(p.starts_at)} → {istDate(p.ends_at)}</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                <button onClick={() => call({ op: "toggle", id: p.id, active: !p.active })} disabled={pending} style={mini}>
                  {p.active ? "Turn off" : "Turn on"}
                </button>
                <button onClick={() => { if (confirm(`Delete promotion "${p.long_title}"?`)) call({ op: "delete", id: p.id }); }} disabled={pending} style={{ ...mini, color: "#B43A16", background: "#FBE9E4" }}>
                  Delete
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
