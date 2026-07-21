"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmt } from "@/lib/format";
import OrderStatusBadge, { STATUS_LABEL } from "@/components/admin/OrderStatusBadge";
import type { OrderRow, Shipment, OrderEvent, OrderItem } from "@/lib/admin/data";
import type { OrderStatus } from "@/lib/admin/order-actions";

/* Admin mutations go through a fixed API route, NOT server actions: action ids
 * rotate every deploy (many per day here), which made confirm/cancel throw
 * from any tab opened before a push. A plain URL survives deployments. */
type ActionResult = { ok: boolean; error?: string };
async function callAdmin(payload: Record<string, unknown>): Promise<ActionResult> {
  const r = await fetch("/api/admin/orders/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  try { return await r.json(); } catch { return { ok: false, error: `Request failed (${r.status}). Try again.` }; }
}
const updateOrderStatus = (orderId: string, status: OrderStatus, note?: string) => callAdmin({ op: "status", orderId, status, note });
const cancelOrder = (orderId: string, reason: string) => callAdmin({ op: "cancel", orderId, reason });
const saveAdminNote = (orderId: string, note: string) => callAdmin({ op: "note", orderId, note });
const addShipment = (input: { order_id: string; courier: string; awb: string; tracking_url?: string; items: { id: string; name: string; qty: number }[] }) => callAdmin({ op: "shipment", ...input });
const markShipmentDelivered = (shipmentId: string, orderId: string, proofUrl?: string) => callAdmin({ op: "deliver", shipmentId, orderId, proofUrl });
const inviteAccount = (orderId: string) => callAdmin({ op: "invite", orderId });
const resendStatusEmail = (orderId: string) => callAdmin({ op: "notify", orderId });
const sendWelcomeOfferEmail = (orderId: string) => callAdmin({ op: "welcome-offer", orderId });
async function uploadDeliveryProof(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await fetch("/api/admin/orders/action", { method: "POST", body: fd });
  try { return await r.json(); } catch { return { ok: false, error: `Upload failed (${r.status}).` }; }
}

export default function OrderDetailClient({ order, shipments, events }: { order: OrderRow; shipments: Shipment[]; events: OrderEvent[] }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const items = order.items ?? [];

  // Remaining-to-ship per line = ordered − already in a shipment.
  const remaining = useMemo(() => {
    const shipped = new Map<string, number>();
    for (const s of shipments) for (const it of s.items ?? []) shipped.set(it.id, (shipped.get(it.id) ?? 0) + it.qty);
    return items.map((it) => ({ ...it, remaining: Math.max(0, it.qty - (shipped.get(it.id) ?? 0)) }));
  }, [items, shipments]);
  const anyRemaining = remaining.some((r) => r.remaining > 0);
  const isClosed = order.status === "delivered" || order.status === "cancelled";

  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      try {
        const res = await fn();
        if (!res.ok) setErr(res.error || "Something went wrong.");
        else router.refresh(); // route-handler mutations don't auto-refresh like server actions did
      } catch {
        setErr("Network hiccup — check your connection and try again.");
      }
    });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Link href="/admin/orders" style={{ fontSize: 13, color: "#8A93A6" }}>← Orders</Link>
        {order.delivered_at && <span style={{ fontSize: 12, color: "#8A93A6" }}>Delivered {new Date(order.delivered_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "6px 0 4px" }}>
        <h1 style={{ fontFamily: "var(--space-mono)", fontSize: 22, fontWeight: 700, margin: 0 }}>{order.id}</h1>
        <OrderStatusBadge status={order.status} size={13} />
      </div>
      <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 18px" }}>Placed {new Date(order.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}{order.payment_method ? ` · ${order.payment_method === "cod" ? "Pay on delivery" : order.payment_method}` : ""}</p>

      {err && <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 14 }}>{err}</div>}
      {order.status === "cancelled" && order.cancel_reason && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 14 }}>Cancelled: {order.cancel_reason}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* ── Left: what to fulfil ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Items">
            {items.map((it, i) => {
              const rem = remaining.find((r) => r.id === it.id)?.remaining ?? 0;
              return (
                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? "1px solid #F4F5F8" : undefined, fontSize: 13.5 }}>
                  <span><b>{it.qty}×</b> {it.name} {rem > 0 && rem < it.qty && <span style={{ color: "#B4690E", fontSize: 11.5 }}>({rem} to ship)</span>}{rem === 0 && <span style={{ color: "#1F9D63", fontSize: 11.5 }}>✓ shipped</span>}</span>
                  {it.price != null && <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>}
                </div>
              );
            })}
            {(order as any).discount_amount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F0F2F6", fontSize: 13, color: "#1F9D63", fontWeight: 600 }}>
                <span>Discount{(order as any).discount_code ? ` · ${(order as any).discount_code}` : ""}</span>
                <span>− {fmt((order as any).discount_amount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10, fontWeight: 700 }}>
              <span>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST</span></span>
              <span style={{ fontFamily: "var(--space-grotesk)" }}>{order.total != null ? fmt(order.total) : "—"}</span>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card title="Ship to">
              <Addr text={order.shipping_address} />
              {order.phone && <div style={{ fontSize: 13, color: "#3A4358", marginTop: 6 }}>📞 {order.phone}</div>}
            </Card>
            <Card title="Bill to / contact">
              <div style={{ fontSize: 13, color: "#3A4358" }}>{order.name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "#8A93A6", margin: "2px 0 6px" }}>{order.email}</div>
              <Addr text={order.billing_address} />
              {order.gstin && <div style={{ fontSize: 12.5, marginTop: 8, fontFamily: "var(--space-mono)", background: "#F3F5F9", padding: "5px 8px", borderRadius: 7 }}>GSTIN {order.gstin}</div>}
            </Card>
          </div>

          <AdminNote orderId={order.id} initial={order.admin_note} pending={pending} run={run} />

          {/* Shipments */}
          <Card title={`Shipments${shipments.length ? ` (${shipments.length})` : ""}`}>
            {shipments.length === 0 && <p style={{ fontSize: 13, color: "#8A93A6", margin: 0 }}>No parcels yet. Create one on the right to ship all or part of this order.</p>}
            {shipments.map((s) => (
              <ShipmentRow key={s.id} s={s} orderId={order.id} pending={pending} run={run} />
            ))}
          </Card>

          {/* Timeline */}
          <Card title="Timeline">
            {events.length === 0 ? <p style={{ fontSize: 13, color: "#8A93A6", margin: 0 }}>No events.</p> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {events.map((e, i) => (
                  <div key={e.id} style={{ display: "flex", gap: 11, paddingBottom: i === events.length - 1 ? 0 : 14, position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4E5BDC", marginTop: 4, flexShrink: 0 }} />
                      {i < events.length - 1 && <span style={{ width: 2, flex: 1, background: "#E8EBF1", marginTop: 2 }} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{STATUS_LABEL(e.status)}</div>
                      {e.note && <div style={{ fontSize: 12, color: "#8A93A6" }}>{e.note}</div>}
                      <div style={{ fontSize: 11, color: "#B0B7C3" }}>{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ── Right: actions ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 20 }}>
          {!isClosed && (
            <Card title="Advance status">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {nextStatuses(order.status).map((st) => (
                  <button key={st} disabled={pending} onClick={() => run(() => updateOrderStatus(order.id, st, undefined))} style={primaryBtn(pending)}>
                    Mark {STATUS_LABEL(st).toLowerCase()}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: "#A0A7B5", margin: "10px 0 0" }}>Each change emails the customer an update.</p>
              <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 12, paddingTop: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {([
                    ["✉️ Invite to create an account", () => inviteAccount(order.id), "Invite sent"],
                    ["🔁 Resend status email", () => resendStatusEmail(order.id), "Status email re-sent"],
                    ["🎁 Send 10% welcome offer", () => sendWelcomeOfferEmail(order.id), "Welcome offer sent"],
                  ] as [string, () => Promise<{ ok: boolean; error?: string }>, string][]).map(([label, fn, okMsg]) => (
                    <button
                      key={label}
                      disabled={pending}
                      onClick={() => {
                        setInviteMsg(null);
                        fn().then((r) => setInviteMsg(r.ok ? `${okMsg} to ${order.email}.` : r.error || "Failed."))
                          .catch(() => setInviteMsg("Network hiccup — try again."));
                      }}
                      style={{ background: "#fff", border: "1.5px solid #4E5BDC", color: "#4E5BDC", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11.5, color: inviteMsg && !inviteMsg.includes("ailed") && !inviteMsg.includes("hiccup") ? "#1F9D63" : "#A0A7B5", margin: "8px 0 0" }}>
                  {inviteMsg ?? "Customer emails: signup invite · resend the current status email · one-time 10% next-order code (30 days, tied to their email)."}
                </p>
              </div>
            </Card>
          )}

          {!isClosed && anyRemaining && <ShipmentForm orderId={order.id} remaining={remaining} pending={pending} run={run} />}

          {!isClosed && (
            <CancelBox orderId={order.id} pending={pending} run={run} />
          )}
          {isClosed && (
            <div style={{ background: order.status === "delivered" ? "#E7F3EC" : "#FBE9E4", borderRadius: 14, padding: "18px 16px", textAlign: "center", fontSize: 13.5, fontWeight: 600, color: order.status === "delivered" ? "#1F7D50" : "#9a3b16" }}>
              {order.status === "delivered" ? "✅ Order delivered" : "This order was cancelled"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function ShipmentForm({ orderId, remaining, pending, run }: { orderId: string; remaining: (OrderItem & { remaining: number })[]; pending: boolean; run: (fn: () => Promise<any>) => void }) {
  const shippable = remaining.filter((r) => r.remaining > 0);
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(shippable.map((r) => [r.id, true])));
  const [courier, setCourier] = useState("");
  const [awb, setAwb] = useState("");
  const [url, setUrl] = useState("");

  const chosen = shippable.filter((r) => sel[r.id]);
  const submit = () => run(() => addShipment({ order_id: orderId, courier, awb, tracking_url: url, items: chosen.map((r) => ({ id: r.id, name: r.name, qty: r.remaining })) }));

  return (
    <Card title="Ship a parcel">
      <label style={lbl}>Items in this parcel</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
        {shippable.map((r) => (
          <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <input type="checkbox" checked={!!sel[r.id]} onChange={(e) => setSel((p) => ({ ...p, [r.id]: e.target.checked }))} />
            {r.remaining}× {r.name}
          </label>
        ))}
      </div>
      <label style={lbl}>Courier</label>
      <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery, Blue Dart…" style={inp} />
      <label style={lbl}>AWB / tracking no.</label>
      <input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" style={inp} />
      <label style={lbl}>Tracking URL (optional)</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={inp} />
      <button disabled={pending || !courier.trim() || !awb.trim() || chosen.length === 0} onClick={submit} style={{ ...primaryBtn(pending), width: "100%", marginTop: 10, opacity: pending || !courier.trim() || !awb.trim() || chosen.length === 0 ? 0.5 : 1 }}>
        {pending ? "Saving…" : `Mark ${chosen.length} item${chosen.length === 1 ? "" : "s"} shipped`}
      </button>
    </Card>
  );
}

function ShipmentRow({ s, orderId, pending, run }: { s: Shipment; orderId: string; pending: boolean; run: (fn: () => Promise<any>) => void }) {
  const [busyProof, setBusyProof] = useState(false);
  const deliver = async (proofUrl?: string) => run(() => markShipmentDelivered(s.id, orderId, proofUrl));

  const onFile = async (file: File) => {
    setBusyProof(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("order_id", orderId);
    const res = await uploadDeliveryProof(fd);
    setBusyProof(false);
    if (res.ok) deliver(res.url);
    else deliver(); // still mark delivered even if upload failed
  };

  return (
    <div style={{ border: "1px solid #EEF0F4", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 13 }}>
          <b>{s.courier || "Parcel"}</b> {s.awb && <span style={{ fontFamily: "var(--space-mono)", color: "#56627A" }}>· {s.awb}</span>}
          <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{(s.items ?? []).map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
        </div>
        <OrderStatusBadge status={s.status} size={11} />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4E5BDC", fontWeight: 600 }}>Track →</a>}
        {s.status !== "delivered" ? (
          <>
            <button disabled={pending} onClick={() => deliver()} style={miniBtn}>Mark delivered</button>
            <label style={{ ...miniBtn, cursor: "pointer", display: "inline-block" }}>
              {busyProof ? "Uploading…" : "+ proof photo"}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </>
        ) : (
          s.proof_url && <a href={s.proof_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#1F9D63", fontWeight: 600 }}>View proof</a>
        )}
      </div>
    </div>
  );
}

function AdminNote({ orderId, initial, pending, run }: { orderId: string; initial: string | null; pending: boolean; run: (fn: () => Promise<any>) => void }) {
  const [note, setNote] = useState(initial ?? "");
  const dirty = note !== (initial ?? "");
  return (
    <Card title="Internal note">
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Notes for your team (not shown to the customer)…" style={{ ...inp, width: "100%", resize: "vertical" }} />
      {dirty && <button disabled={pending} onClick={() => run(() => saveAdminNote(orderId, note))} style={{ ...miniBtn, marginTop: 8 }}>Save note</button>}
    </Card>
  );
}

function CancelBox({ orderId, pending, run }: { orderId: string; pending: boolean; run: (fn: () => Promise<any>) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <Card title="Cancel order">
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ ...miniBtn, color: "#B43A16", borderColor: "#f0c9bd" }}>Cancel this order…</button>
      ) : (
        <>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (emailed to customer)" style={inp} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={pending} onClick={() => run(() => cancelOrder(orderId, reason))} style={{ ...primaryBtn(pending), background: "#B43A16" }}>Confirm cancel</button>
            <button onClick={() => setOpen(false)} style={miniBtn}>Keep</button>
          </div>
        </>
      )}
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "15px 17px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 11 }}>{title}</div>
      {children}
    </div>
  );
}
function Addr({ text }: { text: string | null }) {
  return <div style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text || "—"}</div>;
}

/** Which status buttons to show next, given the current one. */
function nextStatuses(current: string): OrderStatus[] {
  switch (current) {
    case "placed": return ["confirmed"];
    case "confirmed": return ["packed"];
    case "packed": return ["out_for_delivery"]; // (shipping happens via the parcel form)
    case "shipped": return ["out_for_delivery", "delivered"];
    case "partially_shipped": return ["out_for_delivery"];
    case "out_for_delivery": return ["delivered"];
    default: return [];
  }
}

const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", margin: "0 0 4px" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "8px 10px", fontSize: 13, outline: "none", marginBottom: 4, background: "#fff" };
const primaryBtn = (busy: boolean): React.CSSProperties => ({ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 12.5, border: "none", padding: "8px 13px", borderRadius: 9, cursor: busy ? "wait" : "pointer" });
const miniBtn: React.CSSProperties = { background: "#fff", color: "#56627A", fontWeight: 600, fontSize: 12, border: "1px solid #E0E4ED", padding: "6px 11px", borderRadius: 8, cursor: "pointer" };
