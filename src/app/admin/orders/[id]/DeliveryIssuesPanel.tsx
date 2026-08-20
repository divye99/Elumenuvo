"use client";

/**
 * Delivery issues on one order (migration 0126) - the owner's console for a
 * failed delivery: record what happened (exact reason + whose fault, which
 * feeds the courier scorecard), price the redelivery (fee or free "on us"),
 * send the customer their decision link (email and/or WhatsApp), see the
 * decision, apply a corrected address to the order, and close the loop.
 */
import { useState, useTransition } from "react";
import type { DeliveryIssue, Shipment } from "@/lib/admin/data";
import { reportDeliveryIssue, setDeliveryIssueStatus, applyIssueAddress } from "@/lib/admin/order-actions";

const KINDS: [string, string][] = [
  ["undelivered", "Attempt failed"],
  ["rto", "Returned to origin (RTO)"],
  ["address_issue", "Address wrong / incomplete"],
  ["not_reachable", "Customer not reachable"],
  ["refused", "Customer refused"],
  ["damaged", "Damaged in transit"],
  ["lost", "Lost by courier"],
  ["other", "Other"],
];
const FAULTS: [string, string, string][] = [
  ["buyer", "Buyer's fault", "wrong address, unreachable, refused - never counts against the courier"],
  ["courier", "Courier's fault", "no attempt, damage, loss - counts on the scorecard"],
  ["ops", "Our fault", "wrong label, late handover"],
  ["unknown", "Not sure yet", "classify later once you know"],
];

const ISSUE_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  open: { label: "Open", bg: "#FFF6ED", fg: "#B7791F" },
  awaiting_customer: { label: "Awaiting customer", bg: "#EEF0FE", fg: "#4E5BDC" },
  customer_decided: { label: "Customer decided", bg: "#E6F0FF", fg: "#2563C9" },
  redelivery_booked: { label: "Redelivery booked", bg: "#E7F3EC", fg: "#1F9D63" },
  resolved: { label: "Resolved", bg: "#1F9D63", fg: "#fff" },
  cancelled: { label: "Cancelled", bg: "#F3F5F9", fg: "#8A93A6" },
};
const CHOICE_LABEL: Record<string, string> = {
  redeliver: "Redeliver to the SAME address",
  redeliver_new_address: "Redeliver to a CORRECTED address",
  cancel_order: "Cancel the order",
};

const inp: React.CSSProperties = { fontSize: 13, border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 10px", width: "100%" };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#56627A", display: "block", marginBottom: 4 };
const mini: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#4E5BDC", background: "#F3F5F9", border: "none", borderRadius: 8, padding: "7px 12px", cursor: "pointer" };

export default function DeliveryIssuesPanel({ orderId, phone, shipments, issues }: {
  orderId: string;
  phone: string;
  shipments: Shipment[];
  issues: DeliveryIssue[];
}) {
  const [openForm, setOpenForm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latestShip = shipments[shipments.length - 1];

  const [kind, setKind] = useState("undelivered");
  const [fault, setFault] = useState("unknown");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState("0");
  const [feeNote, setFeeNote] = useState("On us - that is Elume customer service");
  const [notify, setNotify] = useState(true);

  const run = (fn: () => Promise<{ ok: boolean; error?: string } | { ok: true; decisionUrl: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!("ok" in res) || !res.ok) setError(("error" in res && res.error) || "Failed");
      else window.location.reload();
    });

  const waMessage = (issue: DeliveryIssue) => {
    const site = window.location.origin.includes("localhost") ? "https://elumenuvo.com" : window.location.origin;
    const link = `${site}/delivery/${issue.decision_token}`;
    const feeLine = Number(issue.redelivery_fee) > 0
      ? `Redelivery carries a charge of Rs ${Math.round(Number(issue.redelivery_fee))}.`
      : `Redelivery is free, on us.`;
    return `Hi! This is Elume about order ${orderId}. The courier could not deliver it (${issue.reason}). ${feeLine} Please choose what happens next here: ${link}`;
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: issues.length || openForm ? 12 : 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>
          Delivery issues{issues.length ? ` (${issues.length})` : ""}
        </div>
        <button onClick={() => setOpenForm((v) => !v)} style={{ ...mini, background: openForm ? "#F3F5F9" : "#FFF6ED", color: openForm ? "#56627A" : "#B7791F" }}>
          {openForm ? "Close" : "⚠ Report delivery issue"}
        </button>
      </div>

      {openForm && (
        <div style={{ border: "1px solid #F0E2CC", background: "#FFFBF4", borderRadius: 12, padding: "14px 14px", marginBottom: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <span style={lbl}>What happened</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)} style={inp}>
                {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <span style={lbl}>Whose fault (drives the courier scorecard)</span>
              <select value={fault} onChange={(e) => setFault(e.target.value)} style={inp}>
                {FAULTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#8A93A6" }}>{FAULTS.find(([v]) => v === fault)?.[2]}</div>
          <div>
            <span style={lbl}>Exact reason (the customer reads this too)</span>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder='e.g. "Courier reports shop closed on two attempts, phone not answering"' style={{ ...inp, minHeight: 60, resize: "vertical" }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
            <div>
              <span style={lbl}>Redelivery fee ₹ (0 = free)</span>
              <input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="numeric" style={inp} />
            </div>
            <div>
              <span style={lbl}>Fee framing the customer sees</span>
              <input value={feeNote} onChange={(e) => setFeeNote(e.target.value)} style={inp} />
              <div style={{ display: "flex", gap: 6, marginTop: 5 }}>
                <button type="button" onClick={() => { setFee("0"); setFeeNote("On us - that is Elume customer service"); }} style={{ ...mini, fontSize: 11, padding: "4px 9px" }}>Free, on us</button>
                <button type="button" onClick={() => { setFeeNote("collected along with the redelivered parcel"); }} style={{ ...mini, fontSize: 11, padding: "4px 9px" }}>Collect with parcel</button>
              </div>
            </div>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email the customer their decision link now (you can also WhatsApp it after saving)
          </label>
          <button
            disabled={pending || reason.trim().length < 8}
            onClick={() => run(() => reportDeliveryIssue({
              orderId,
              shipmentId: latestShip?.id ?? null,
              kind, fault,
              reason: reason.trim(),
              courier: latestShip?.courier ?? null,
              awb: latestShip?.awb ?? null,
              redeliveryFee: Number(fee) || 0,
              feeNote: feeNote.trim() || null,
              notifyCustomer: notify,
            }))}
            style={{ background: pending || reason.trim().length < 8 ? "#C9CFDD" : "#B7791F", color: "#fff", fontSize: 13.5, fontWeight: 700, padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", justifySelf: "start" }}
          >
            {pending ? "Saving…" : "Record issue"}
          </button>
        </div>
      )}

      {issues.length === 0 && !openForm && (
        <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "8px 0 0" }}>
          No delivery problems recorded. If a parcel bounces (RTO, wrong address, refused), report it here: the customer gets a decision link and the courier scorecard learns the reason.
        </p>
      )}

      {issues.map((issue) => {
        const st = ISSUE_STATUS[issue.status] ?? ISSUE_STATUS.open;
        const link = `${typeof window !== "undefined" && !window.location.origin.includes("localhost") ? window.location.origin : "https://elumenuvo.com"}/delivery/${issue.decision_token}`;
        const active = issue.status !== "resolved" && issue.status !== "cancelled";
        return (
          <div key={issue.id} style={{ border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, background: st.bg, color: st.fg, borderRadius: 7, padding: "3px 9px" }}>{st.label.toUpperCase()}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{KINDS.find(([v]) => v === issue.kind)?.[1] ?? issue.kind}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: issue.fault === "courier" ? "#B43A16" : issue.fault === "buyer" ? "#B7791F" : "#8A93A6" }}>
                {issue.fault === "buyer" ? "buyer fault (not on courier)" : `${issue.fault} fault`}
              </span>
              {issue.courier && <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{issue.courier}{issue.awb ? ` · ${issue.awb}` : ""}</span>}
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#A0A7B5" }}>{new Date(issue.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}</span>
            </div>
            <div style={{ fontSize: 13, color: "#19202E", marginBottom: 6 }}>{issue.reason}</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: Number(issue.redelivery_fee) > 0 ? "#B7791F" : "#1F9D63", marginBottom: 8 }}>
              {Number(issue.redelivery_fee) > 0 ? `Redelivery fee ₹${Math.round(Number(issue.redelivery_fee)).toLocaleString("en-IN")}` : "Free redelivery"}{issue.fee_note ? ` · ${issue.fee_note}` : ""}
            </div>

            {issue.customer_choice ? (
              <div style={{ background: "#F3F7FF", border: "1px solid #D8E4FA", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#2563C9" }}>Customer decided: {CHOICE_LABEL[issue.customer_choice]}</div>
                {issue.new_address && <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", margin: "6px 0" }}>{issue.new_address}</div>}
                {issue.customer_note && <div style={{ fontSize: 12, color: "#56627A" }}>Note: {issue.customer_note}</div>}
                {issue.new_address && active && (
                  <button onClick={() => run(() => applyIssueAddress(issue.id, orderId))} disabled={pending} style={{ ...mini, marginTop: 6 }}>
                    Apply corrected address to the order
                  </button>
                )}
              </div>
            ) : active && (
              <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 8 }}>No decision from the customer yet.</div>
            )}

            {active && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button onClick={() => { navigator.clipboard.writeText(link); }} style={mini}>Copy decision link</button>
                <a
                  href={`https://wa.me/${(phone || "").replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(waMessage(issue))}`}
                  target="_blank" rel="noreferrer"
                  style={{ ...mini, textDecoration: "none", background: "#E7F6EE", color: "#1F9D63" }}
                >
                  WhatsApp the customer →
                </a>
                {issue.customer_choice !== "cancel_order" && (
                  <button onClick={() => run(() => setDeliveryIssueStatus(issue.id, orderId, "redelivery_booked", "Redelivery booked with the courier"))} disabled={pending} style={mini}>
                    Mark redelivery booked
                  </button>
                )}
                <button onClick={() => run(() => setDeliveryIssueStatus(issue.id, orderId, "resolved", "Delivery issue resolved"))} disabled={pending} style={{ ...mini, background: "#E7F6EE", color: "#1F9D63" }}>
                  Resolve
                </button>
                <button onClick={() => run(() => setDeliveryIssueStatus(issue.id, orderId, "cancelled", "Delivery issue closed without action"))} disabled={pending} style={{ ...mini, background: "#F3F5F9", color: "#8A93A6" }}>
                  Close
                </button>
              </div>
            )}
          </div>
        );
      })}

      {error && <div style={{ fontSize: 13, color: "#C0392B", fontWeight: 600, marginTop: 8 }}>{error}</div>}
    </div>
  );
}
