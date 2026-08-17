"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmt } from "@/lib/format";
import { gstRateFor } from "@/lib/pricing";

/** Line total ex-GST, exact paise (prices are stored GST-inclusive). */
const exGstOf = (it: { price?: number; qty: number; cat?: string; gstRate?: number }) =>
  (it.price ?? 0) * it.qty / (1 + gstRateFor(it.cat, it.gstRate));
const fmt2 = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
const issueRefund = (orderId: string, amount: number, reason: string): Promise<ActionResult & { refundId?: string }> =>
  callAdmin({ op: "refund", orderId, amount, reason }) as Promise<ActionResult & { refundId?: string }>;
const saveAdminNote = (orderId: string, note: string) => callAdmin({ op: "note", orderId, note });
const addShipment = (input: { order_id: string; courier: string; awb: string; tracking_url?: string; items: { id: string; name: string; qty: number }[] }) => callAdmin({ op: "shipment", ...input });
const markShipmentDelivered = (shipmentId: string, orderId: string, proofUrl?: string) => callAdmin({ op: "deliver", shipmentId, orderId, proofUrl });
const inviteAccount = (orderId: string) => callAdmin({ op: "invite", orderId });
const fetchSimilar = (orderId: string, itemId: string): Promise<any> => callAdmin({ op: "similar", orderId, itemId });
const replaceItemAbsorb = (orderId: string, oldItemId: string, newProductId: string) => callAdmin({ op: "replace-item", orderId, oldItemId, newProductId });
const replaceViaNewOrder = (orderId: string, oldItemId: string, newProductId: string) => callAdmin({ op: "replace-order", orderId, oldItemId, newProductId });
const refundItem = (orderId: string, itemId: string) => callAdmin({ op: "refund-item", orderId, itemId });
const resendStatusEmail = (orderId: string) => callAdmin({ op: "notify", orderId });
const markBalanceReceived = (orderId: string) => callAdmin({ op: "metals-balance-received", orderId });
const sendWelcomeOfferEmail = (orderId: string) => callAdmin({ op: "welcome-offer", orderId });
async function uploadDeliveryProof(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = await fetch("/api/admin/orders/action", { method: "POST", body: fd });
  try { return await r.json(); } catch { return { ok: false, error: `Upload failed (${r.status}).` }; }
}

export default function OrderDetailClient({ order, shipments, events, customer }: { order: OrderRow; shipments: Shipment[]; events: OrderEvent[]; customer: { hasAccount: boolean; orderCount: number } }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [swapItem, setSwapItem] = useState<string | null>(null);
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
        setErr("Network hiccup - check your connection and try again.");
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
                <React.Fragment key={it.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: i ? "1px solid #F4F5F8" : undefined, fontSize: 13.5 }}>
                  <span>
                    <b>{it.qty}×</b>{" "}
                    {it.id ? (
                      <a href={`/catalogue/${it.id}`} target="_blank" rel="noreferrer" title="Open the live product page" style={{ color: "#19202E", textDecoration: "underline", textDecorationColor: "#C9CFF6", textUnderlineOffset: 3 }}>
                        {it.name}
                      </a>
                    ) : it.name}{" "}
                    {rem > 0 && rem < it.qty && <span style={{ color: "#B4690E", fontSize: 11.5 }}>({rem} to ship)</span>}{rem === 0 && <span style={{ color: "#1F9D63", fontSize: 11.5 }}>✓ shipped</span>}
                    {!isClosed && (
                      <button onClick={() => setSwapItem(swapItem === it.id ? null : it.id)} style={{ marginLeft: 8, background: "none", border: "1px solid #E0E4ED", borderRadius: 7, color: "#4E5BDC", fontSize: 11, fontWeight: 700, padding: "2px 8px", cursor: "pointer" }}>
                        {swapItem === it.id ? "Close" : "Unavailable?"}
                      </button>
                    )}
                  </span>
                  <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {it.price != null && <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>}
                    {it.price != null && (
                      // Ex-GST alongside inclusive - the paise matter for accounting,
                      // so this line keeps 2 decimals instead of fmt()'s whole rupees.
                      <span style={{ display: "block", fontSize: 10.5, color: "#A0A7B5", fontWeight: 600 }}>
                        {fmt2(exGstOf(it))} ex-GST · {fmt(it.price * it.qty)} incl.
                      </span>
                    )}
                    {(it.hsn || it.gstRate != null) && (
                      <span style={{ display: "block", fontSize: 10.5, color: "#A0A7B5", fontWeight: 600 }}>
                        {it.hsn ? `HSN ${it.hsn}` : ""}{it.hsn && it.gstRate != null ? " · " : ""}{it.gstRate != null ? `${Math.round(it.gstRate * 100)}% GST` : ""}
                      </span>
                    )}
                  </span>
                </div>
                {swapItem === it.id && (
                  <SwapPanel
                    orderId={order.id}
                    item={it}
                    pending={pending}
                    run={run}
                    onDone={() => setSwapItem(null)}
                  />
                )}
                </React.Fragment>
              );
            })}
            {(order as any).discount_amount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F0F2F6", fontSize: 13, color: "#1F9D63", fontWeight: 600 }}>
                <span>Discount{(order as any).discount_code ? ` · ${(order as any).discount_code}` : ""}</span>
                <span>− {fmt((order as any).discount_amount)}</span>
              </div>
            )}
            {Number((order as any).shipping_fee ?? 0) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 13, color: "#56627A" }}>
                <span>Delivery</span>
                <span>{fmt(Number((order as any).shipping_fee))}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10, fontWeight: 700 }}>
              <span>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST{Number((order as any).shipping_fee ?? 0) > 0 ? " + delivery" : ""}</span></span>
              <span style={{ fontFamily: "var(--space-grotesk)" }}>{order.total != null ? fmt(order.total) : "-"}</span>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card title="Ship to">
              <Addr text={order.shipping_address} />
              {order.phone && <div style={{ fontSize: 13, color: "#3A4358", marginTop: 6 }}>📞 {order.phone}</div>}
            </Card>
            <Card title="Bill to / contact">
              <div style={{ fontSize: 13, color: "#3A4358" }}>{order.name || "-"}</div>
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
          {/* Shipping first (owner): it is the most-used action on an open order. */}
          {!isClosed && anyRemaining && <ShipmentForm orderId={order.id} remaining={remaining} pending={pending} run={run} />}
          <Card title="Invoices">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a
                href={`/api/admin/orders/${encodeURIComponent(order.id)}/invoice?type=proforma`}
                target="_blank"
                rel="noreferrer"
                style={{ background: "#fff", border: "1.5px solid #4E5BDC", color: "#4E5BDC", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9 }}
              >
                Proforma invoice (PDF)
              </a>
              <a
                href={`/api/admin/orders/${encodeURIComponent(order.id)}/invoice?type=tax`}
                target="_blank"
                rel="noreferrer"
                style={{ background: "#4E5BDC", border: "1.5px solid #4E5BDC", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9 }}
              >
                Tax invoice (PDF)
              </a>
            </div>
            <p style={{ fontSize: 11.5, color: "#A0A7B5", margin: "10px 0 0" }}>
              GST format for accounting. The tax invoice gets a sequential FY number on first generation and keeps it forever; the proforma is marked "not a tax invoice" and safe to share before payment.
            </p>
          </Card>
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
                  {/* Account holders don't need an invite; show their order history instead */}
                  {customer.hasAccount && (
                    <Link
                      href={`/admin/orders?email=${encodeURIComponent(order.email)}`}
                      style={{ background: "#EFFAF4", border: "1.5px solid #1F9D63", color: "#1F9D63", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9 }}
                    >
                      👤 Has an account · all their orders ({customer.orderCount})
                    </Link>
                  )}
                  {/* Each button carries its send history, derived from the
                      order_events log (the route inserts a marker event on
                      every successful send - the phrases below must match). */}
                  {([
                    ...(customer.hasAccount ? [] : [["✉️ Invite to create an account", () => inviteAccount(order.id), "Invite sent", "Signup invite emailed"] as const]),
                    ["🔁 Resend status email", () => resendStatusEmail(order.id), "Status email re-sent", "Status email re-sent"],
                    ["🎁 Send 10% welcome offer", () => sendWelcomeOfferEmail(order.id), "Welcome offer sent", "Welcome offer emailed"],
                  ] as [string, () => Promise<{ ok: boolean; error?: string }>, string, string][]).map(([label, fn, okMsg, phrase]) => {
                    const sends = events.filter((e) => e.note?.includes(phrase));
                    const last = sends.length ? sends.map((e) => new Date(e.created_at)).sort((a, b) => b.getTime() - a.getTime())[0] : null;
                    return (
                      <div key={label} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <button
                          disabled={pending}
                          onClick={() => {
                            setInviteMsg(null);
                            fn().then((r) => setInviteMsg(r.ok ? `${okMsg} to ${order.email}.` : r.error || "Failed."))
                              .catch(() => setInviteMsg("Network hiccup - try again."));
                          }}
                          style={{ background: "#fff", border: "1.5px solid #4E5BDC", color: "#4E5BDC", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}
                        >
                          {label}
                        </button>
                        <span style={{ fontSize: 10.5, fontWeight: 600, textAlign: "center", color: last ? "#1F9D63" : "#B0B7C3" }}>
                          {last
                            ? `Sent ${sends.length}× · last ${last.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`
                            : "Not sent yet"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11.5, color: inviteMsg && !inviteMsg.includes("ailed") && !inviteMsg.includes("hiccup") ? "#1F9D63" : "#A0A7B5", margin: "8px 0 0" }}>
                  {inviteMsg ?? (customer.hasAccount
                    ? "This customer has an Elume account, so orders appear in their dashboard automatically. Emails: resend current status · one-time 10% next-order code (30 days, tied to their email)."
                    : "Customer emails: signup invite · resend the current status email · one-time 10% next-order code (30 days, tied to their email).")}
                </p>
              </div>
            </Card>
          )}

          {(order as any).order_kind === "metals_booking" && (
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#19202E", marginBottom: 10 }}>🥉 Copper booking · token + RTGS</div>
              {[
                ["Order value", fmt(Number(order.total))],
                ["Token received online (5%)", fmt(Number((order as any).token_amount ?? 0))],
                ["Balance due by RTGS", fmt(Number((order as any).balance_due ?? 0))],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "6px 0", fontSize: 13 }}>
                  <span style={{ color: "#56627A" }}>{k}</span>
                  <span style={{ fontWeight: 700 }}>{v}</span>
                </div>
              ))}
              {(order as any).balance_received_at ? (
                <div style={{ marginTop: 8, background: "#E6F5EE", color: "#137a4b", fontWeight: 700, fontSize: 12.5, borderRadius: 9, padding: "8px 12px", textAlign: "center" }}>
                  ✓ Balance received {new Date((order as any).balance_received_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                </div>
              ) : (
                <button
                  disabled={pending}
                  onClick={() => { if (window.confirm("Confirm the full RTGS balance is in the bank? The customer is emailed that dispatch is being scheduled.")) run(() => markBalanceReceived(order.id)); }}
                  style={{ width: "100%", marginTop: 8, background: "#1F9D63", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", padding: "10px 12px", borderRadius: 9, cursor: "pointer" }}
                >
                  Mark RTGS balance received
                </button>
              )}
            </div>
          )}

          {order.status !== "cancelled" && (order as any).razorpay_payment_id && (
            <RefundPanel order={order} run={run} pending={pending} />
          )}

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

type SrCourier = {
  courierId: number; name: string; rate: number; etd: string; estimatedDays: number; rating: number | null;
  chargeWeightKg: number | null; pickupInDays: number | null; pickupDate: string | null; cutoffTime: string | null;
  mode: "Surface" | "Air"; pickupRating: number | null; deliveryRating: number | null;
  realtimeTracking: boolean; callBeforeDelivery: boolean;
};
type SrRates = { ok: true; couriers: SrCourier[]; pickups: { name: string; city: string; pin: string }[]; pickup: string; deliveryPin: string; balance: number | null; distanceKm: number | null } | { ok: false; error: string };
type SrShip = { ok: true; awb: string; courierName: string; freight: number | null; labelUrl: string | null; pickupScheduled: boolean } | { ok: false; error: string };

function ShipmentForm({ orderId, remaining, pending, run }: { orderId: string; remaining: (OrderItem & { remaining: number })[]; pending: boolean; run: (fn: () => Promise<any>) => void }) {
  const shippable = remaining.filter((r) => r.remaining > 0);
  const [sel, setSel] = useState<Record<string, boolean>>(() => Object.fromEntries(shippable.map((r) => [r.id, true])));
  const chosen = shippable.filter((r) => sel[r.id]);

  // Shiprocket flow state. Weight/dims are what the admin ACTUALLY measured at
  // packing - rates and the courier's billing both ride on these numbers.
  const [weight, setWeight] = useState("1");
  const [dims, setDims] = useState({ l: "30", b: "25", h: "15" });
  const [pickup, setPickup] = useState<string>("");
  const [rates, setRates] = useState<SrRates | null>(null);
  const [showRates, setShowRates] = useState(false);
  const [busy, setBusy] = useState(false);
  const [courierId, setCourierId] = useState<number | null>(null);
  const [booked, setBooked] = useState<Extract<SrShip, { ok: true }> | null>(null);
  const [srErr, setSrErr] = useState<string | null>(null);
  const [manual, setManual] = useState(false);

  // Manual fallback fields (the pre-Shiprocket form, kept for edge cases).
  const [courier, setCourier] = useState("");
  const [awb, setAwb] = useState("");
  const [url, setUrl] = useState("");

  const fetchRates = async (pickupName?: string) => {
    setBusy(true); setSrErr(null); setCourierId(null);
    try {
      const r = await callAdmin({
        op: "sr-rates", orderId, pickup: pickupName || pickup || undefined,
        weightKg: Number(weight) || 1, lengthCm: Number(dims.l), breadthCm: Number(dims.b), heightCm: Number(dims.h),
      }) as unknown as SrRates;
      setRates(r);
      if (r.ok) { setPickup(r.pickup); setShowRates(true); }
      else setSrErr(r.error);
    } catch { setSrErr("Network hiccup - try again."); }
    setBusy(false);
  };

  const book = async () => {
    const opt = rates?.ok ? rates.couriers.find((c) => c.courierId === courierId) : null;
    if (!opt) return;
    if (!window.confirm(`Book ${chosen.length} item(s) with ${opt.name} for ₹${opt.rate}? Pickup: ${pickup}. The customer is emailed the tracking link.`)) return;
    setBusy(true); setSrErr(null);
    try {
      const r = await callAdmin({
        op: "sr-ship", orderId, items: chosen.map((c) => ({ id: c.id, name: c.name, qty: c.remaining })),
        pickup, courierId: opt.courierId, courierName: opt.name,
        weightKg: Number(weight) || 1, lengthCm: Number(dims.l), breadthCm: Number(dims.b), heightCm: Number(dims.h),
      }) as unknown as SrShip;
      if (r.ok) { setBooked(r); run(async () => ({ ok: true })); /* refresh page data */ }
      else setSrErr(r.error);
    } catch { setSrErr("Network hiccup - try again."); }
    setBusy(false);
  };

  const submitManual = () => run(() => addShipment({ order_id: orderId, courier, awb, tracking_url: url, items: chosen.map((r) => ({ id: r.id, name: r.name, qty: r.remaining })) }));

  if (booked) {
    return (
      <Card title="Ship a parcel">
        <div style={{ background: "#E6F5EE", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#137a4b" }}>
          <b>✓ Booked with {booked.courierName}</b>
          <div style={{ fontFamily: "var(--space-mono)", fontSize: 12.5, margin: "4px 0" }}>AWB {booked.awb}</div>
          {booked.freight != null && <div>Freight: ₹{booked.freight}</div>}
          <div style={{ fontSize: 12 }}>{booked.pickupScheduled ? "Pickup scheduled." : "⚠ Pickup NOT scheduled - request it from the Shiprocket panel."}</div>
          {booked.labelUrl && (
            <a href={booked.labelUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 8, background: "#1F9D63", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "8px 14px", borderRadius: 8 }}>
              Print label (PDF)
            </a>
          )}
        </div>
      </Card>
    );
  }

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={lbl}>Weighed (kg)</label>
          <input value={weight} onChange={(e) => setWeight(e.target.value)} inputMode="decimal" style={inp} />
        </div>
        <div>
          <label style={lbl}>Box L×B×H (cm)</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["l", "b", "h"] as const).map((k) => (
              <input key={k} value={dims[k]} onChange={(e) => setDims((p) => ({ ...p, [k]: e.target.value }))} inputMode="numeric" style={{ ...inp, padding: "8px 6px", textAlign: "center" }} />
            ))}
          </div>
        </div>
      </div>
      {/* Live weight maths: couriers bill the HIGHER of dead and volumetric. */}
      {(() => {
        const dead = Number(weight) || 0;
        const vol = (Number(dims.l) * Number(dims.b) * Number(dims.h)) / 5000 || 0;
        const chargeable = Math.max(dead, vol);
        const volWins = vol > dead;
        return (
          <div style={{ background: "#F3F5F9", borderRadius: 9, padding: "7px 10px", margin: "2px 0 8px", fontSize: 11, color: "#56627A", display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span>Dead: <b>{dead.toFixed(2)} kg</b></span>
            <span>Volumetric (÷5000): <b>{vol.toFixed(2)} kg</b></span>
            <span style={{ color: volWins ? "#B4690E" : "#1F9D63" }}>Chargeable: <b>{chargeable.toFixed(2)} kg</b>{volWins ? " (volumetric wins - smaller box saves money)" : ""}</span>
          </div>
        );
      })()}

      {rates?.ok && rates.pickups.length > 1 && (
        <>
          <label style={lbl}>Pickup from</label>
          <select value={pickup} onChange={(e) => { setPickup(e.target.value); fetchRates(e.target.value); }} style={{ ...inp, appearance: "auto" as const }}>
            {rates.pickups.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.city} {p.pin}</option>)}
          </select>
        </>
      )}

      <button disabled={busy || chosen.length === 0} onClick={() => (rates?.ok && !busy ? setShowRates(true) : fetchRates())} style={{ ...primaryBtn(busy), width: "100%", marginTop: 4, opacity: busy || chosen.length === 0 ? 0.6 : 1 }}>
        {busy ? "Fetching rates…" : rates?.ok ? "Choose courier →" : "Compare couriers & book"}
      </button>
      {rates?.ok && !busy && (
        <button onClick={() => fetchRates()} style={{ background: "none", border: "none", color: "#4E5BDC", fontSize: 11, fontWeight: 700, padding: 0, marginTop: 6, cursor: "pointer" }}>
          ↻ Refresh rates (after changing weight/box)
        </button>
      )}

      {/* Courier picker MODAL - a proper window with the full decision data:
          pickup date, estimated delivery date, chargeable weight, ratings. */}
      {rates?.ok && showRates && (
        <div onClick={() => setShowRates(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,24,45,.5)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: 700, maxWidth: "96vw", maxHeight: "88vh", overflowY: "auto", padding: "20px 22px", boxShadow: "0 30px 80px rgba(20,24,45,.3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>Choose a courier</div>
              <button onClick={() => setShowRates(false)} style={{ border: "none", background: "#F3F5F9", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 15 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: "#8A93A6", margin: "0 0 12px" }}>
              {rates.pickup} → {rates.deliveryPin}{rates.distanceKm != null ? ` (~${rates.distanceKm.toLocaleString("en-IN")} km)` : ""} · entered {Number(weight).toFixed(2)} kg dead · {((Number(dims.l) * Number(dims.b) * Number(dims.h)) / 5000 || 0).toFixed(2)} kg volumetric ({dims.l}×{dims.b}×{dims.h} cm ÷ 5000). Couriers bill the higher "chargeable" weight shown per row.
              {rates.balance != null && (
                <span style={{ display: "inline-block", marginLeft: 8, fontWeight: 700, color: rates.balance < 500 ? "#C2410C" : "#1F9D63" }}>
                  Shiprocket wallet: ₹{rates.balance.toLocaleString("en-IN")}{rates.balance < 500 ? " - low, recharge before booking" : ""}
                </span>
              )}
            </p>
            {rates.couriers.length === 0 && <p style={{ fontSize: 13, color: "#B4690E" }}>No courier serves this route at this weight.</p>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rates.couriers.slice(0, 10).map((c) => {
                // suppress_date is the courier's real next-pickup date - the
                // bare pickup_availability flag claims "today" even past the
                // daily cutoff, which mislabelled evening bookings.
                const pd = c.pickupDate ? new Date(c.pickupDate) : null;
                const sameDay = pd && pd.toDateString() === new Date().toDateString();
                const pickupLabel = pd
                  ? sameDay
                    ? `Today${c.cutoffTime ? ` (by ${c.cutoffTime})` : ""}`
                    : pd.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                  : "-";
                const sel = courierId === c.courierId;
                return (
                  <label key={c.courierId} style={{ display: "grid", gridTemplateColumns: "18px 1.4fr 1fr 1fr 0.9fr 0.7fr", alignItems: "center", gap: 10, border: `1.5px solid ${sel ? "#4E5BDC" : "#E8EBF1"}`, borderRadius: 11, padding: "10px 12px", cursor: "pointer", background: sel ? "#F6F7FE" : "#fff" }}>
                    <input type="radio" name="sr-courier" checked={sel} onChange={() => setCourierId(c.courierId)} />
                    <span>
                      <span style={{ fontSize: 13, fontWeight: 700, display: "block" }}>{c.name}</span>
                      <span style={{ fontSize: 10.5, color: "#8A93A6" }}>
                        {c.mode}{c.rating ? ` · ★${c.rating.toFixed(2)} overall` : ""}
                        {c.pickupRating ? ` · pickup ★${c.pickupRating.toFixed(1)}` : ""}{c.deliveryRating ? ` · delivery ★${c.deliveryRating.toFixed(1)}` : ""}
                      </span>
                      <span style={{ fontSize: 10, color: "#A0A7B5" }}>{[c.realtimeTracking ? "live tracking" : null, c.callBeforeDelivery ? "calls before delivery" : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span style={{ fontSize: 11.5 }}>
                      <span style={{ color: "#8A93A6", display: "block", fontSize: 10 }}>Pickup</span>
                      <b>{pickupLabel}</b>
                    </span>
                    <span style={{ fontSize: 11.5 }}>
                      <span style={{ color: "#8A93A6", display: "block", fontSize: 10 }}>Est. delivery</span>
                      <b>{c.etd || "-"}</b>{c.estimatedDays ? <span style={{ color: "#8A93A6" }}> ({c.estimatedDays}d)</span> : null}
                    </span>
                    <span style={{ fontSize: 11.5 }}>
                      <span style={{ color: "#8A93A6", display: "block", fontSize: 10 }}>Chargeable wt</span>
                      <b>{c.chargeWeightKg != null ? `${c.chargeWeightKg.toFixed(2)} kg` : "-"}</b>
                    </span>
                    <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 15, textAlign: "right" }}>₹{Math.round(c.rate).toLocaleString("en-IN")}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={() => setShowRates(false)} style={{ flex: "0 0 auto", background: "#fff", border: "1.5px solid #D8DCE6", color: "#19202E", fontWeight: 700, fontSize: 12.5, padding: "10px 16px", borderRadius: 9, cursor: "pointer" }}>Cancel</button>
              <button disabled={busy || courierId == null} onClick={book} style={{ ...primaryBtn(busy), flex: 1, opacity: busy || courierId == null ? 0.5 : 1 }}>
                {busy ? "Booking…" : courierId != null ? `Book with ${rates.couriers.find((c) => c.courierId === courierId)?.name} · ₹${Math.round(rates.couriers.find((c) => c.courierId === courierId)?.rate ?? 0).toLocaleString("en-IN")}` : "Select a courier to book"}
              </button>
            </div>
          </div>
        </div>
      )}
      {srErr && <p style={{ fontSize: 12.5, color: "#C2410C", margin: "8px 0 0" }}>{srErr}</p>}

      <button onClick={() => setManual((m) => !m)} style={{ background: "none", border: "none", color: "#8A93A6", fontSize: 11.5, fontWeight: 600, padding: 0, marginTop: 12, cursor: "pointer" }}>
        {manual ? "Hide manual entry" : "Shipped outside Shiprocket? Manual entry →"}
      </button>
      {manual && (
        <div style={{ marginTop: 8 }}>
          <label style={lbl}>Courier</label>
          <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Delhivery, Blue Dart…" style={inp} />
          <label style={lbl}>AWB / tracking no.</label>
          <input value={awb} onChange={(e) => setAwb(e.target.value)} placeholder="e.g. 1234567890" style={inp} />
          <label style={lbl}>Tracking URL (optional)</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={inp} />
          <button disabled={pending || !courier.trim() || !awb.trim() || chosen.length === 0} onClick={submitManual} style={{ ...primaryBtn(pending), width: "100%", marginTop: 10, opacity: pending || !courier.trim() || !awb.trim() || chosen.length === 0 ? 0.5 : 1 }}>
            {pending ? "Saving…" : `Mark ${chosen.length} item${chosen.length === 1 ? "" : "s"} shipped`}
          </button>
        </div>
      )}
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
  return <div style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{text || "-"}</div>;
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

/** Unavailable-item resolution: similar-product suggestions, manual SKU
 *  override, replace (absorb difference) / replace via new PO / refund with
 *  a 10% apology voucher. */
function SwapPanel({ orderId, item, pending, run, onDone }: { orderId: string; item: { id: string; name: string; qty: number; price?: number }; pending: boolean; run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void; onDone: () => void }) {
  const [sugs, setSugs] = useState<{ id: string; name: string; brand: string; price: number }[] | null>(null);
  const [chosen, setChosen] = useState<string>("");
  const [manual, setManual] = useState("");
  const [confirmRefund, setConfirmRefund] = useState(false);

  React.useEffect(() => {
    fetchSimilar(orderId, item.id).then((r: any) => setSugs(r.ok ? r.suggestions : []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const target = manual.trim() || chosen;
  const btn: React.CSSProperties = { fontSize: 12, fontWeight: 700, border: "none", borderRadius: 8, padding: "8px 13px", cursor: "pointer" };

  return (
    <div style={{ margin: "4px 0 12px", background: "#F8F9FC", border: "1px solid #E8EBF1", borderRadius: 12, padding: "13px 15px" }}>
      <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.4px", color: "#8A93A6", marginBottom: 8 }}>
        Replace “{item.name}”
      </div>

      {sugs === null && <div style={{ fontSize: 12.5, color: "#8A93A6" }}>Finding similar products…</div>}
      {sugs && sugs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 }}>
          {sugs.map((sp) => (
            <label key={sp.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12.5, cursor: "pointer", padding: "5px 8px", borderRadius: 8, background: chosen === sp.id ? "#EEF0FE" : "transparent" }}>
              <input type="radio" name={`swap-${item.id}`} checked={chosen === sp.id} onChange={() => { setChosen(sp.id); setManual(""); }} />
              <span style={{ flex: 1 }}>{sp.name} <span style={{ color: "#8A93A6" }}>· {sp.brand}</span></span>
              <b style={{ fontFamily: "var(--space-grotesk)" }}>{fmt(sp.price)}</b>
            </label>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <input value={manual} onChange={(e) => { setManual(e.target.value); setChosen(""); }} placeholder="…or type a product id / SKU (e.g. hav-lhextip7cn1m010)" style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 8, padding: "8px 11px", fontSize: 12.5 }} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={pending || !target} onClick={() => run(() => replaceItemAbsorb(orderId, item.id, target), "Item replaced at the same billed amount, customer emailed.")} style={{ ...btn, background: "#4E5BDC", color: "#fff", opacity: pending || !target ? 0.5 : 1 }}>
          Replace · keep the bill exactly as paid
        </button>
        <button disabled={pending || !target} onClick={() => run(() => replaceViaNewOrder(orderId, item.id, target), "Replacement order created at current price, original cancelled, customer emailed.")} style={{ ...btn, background: "#fff", color: "#4E5BDC", border: "1.5px solid #4E5BDC", opacity: pending || !target ? 0.5 : 1 }}>
          Replace via new PO · re-bill at current price
        </button>
        {!confirmRefund ? (
          <button disabled={pending} onClick={() => setConfirmRefund(true)} style={{ ...btn, background: "#fff", color: "#B43A16", border: "1.5px solid #E8C4B8" }}>
            Refund this item + 10% voucher
          </button>
        ) : (
          <button disabled={pending} onClick={() => { setConfirmRefund(false); run(() => refundItem(orderId, item.id), `Refunded ${fmt((item.price ?? 0) * item.qty)} + voucher sent.`); }} style={{ ...btn, background: "#B43A16", color: "#fff" }}>
            Confirm refund {fmt((item.price ?? 0) * item.qty)} to customer
          </button>
        )}
        <button onClick={onDone} style={{ ...btn, background: "none", color: "#8A93A6" }}>Cancel</button>
      </div>
      <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 8 }}>
        Keep the bill: the item swaps at the price already paid, so the total, the payment and the invoice amount never move (the GST split is recalculated if the replacement sits at a different rate). New PO: the original cancels and a fresh order bills the current price, so any difference is settled. Refund: money back via Razorpay plus a one-time 10% code emailed.
      </div>
    </div>
  );
}

/** Order-level refund: admin picks the amount (prefilled with the full total)
 *  and an optional reason; Razorpay processes it and the customer receives a
 *  branded refund receipt carrying the rfnd_/pay_ references. Two-step
 *  confirm because this moves real money. */
function RefundPanel({ order, run, pending }: { order: OrderRow; run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void; pending: boolean }) {
  const total = Number(order.total ?? 0);
  const [amount, setAmount] = useState(String(total));
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const amt = Number(amount);
  const valid = amt > 0 && amt <= total;
  const partial = valid && amt < total;

  return (
    <Card title="Refund">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "#56627A" }}>Amount</span>
        <input
          value={amount}
          onChange={(e) => { setAmount(e.target.value.replace(/[^\d.]/g, "")); setConfirming(false); }}
          inputMode="decimal"
          style={{ width: 110, border: "1px solid #E0E4ED", borderRadius: 8, padding: "8px 10px", fontSize: 13, fontFamily: "var(--space-grotesk)", fontWeight: 700 }}
        />
        <span style={{ fontSize: 11.5, color: "#A0A7B5" }}>of {fmt(total)} paid</span>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason shown to the customer (optional)"
        style={{ width: "100%", boxSizing: "border-box", marginTop: 8, border: "1px solid #E0E4ED", borderRadius: 8, padding: "8px 10px", fontSize: 12.5 }}
      />
      <div style={{ marginTop: 10 }}>
        {!confirming ? (
          <button
            disabled={pending || !valid}
            onClick={() => setConfirming(true)}
            style={{ background: "#fff", border: "1.5px solid #E8C4B8", color: "#B43A16", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer", opacity: valid ? 1 : 0.5 }}
          >
            {valid ? (partial ? `Refund ${fmt(amt)} (partial)` : `Refund ${fmt(amt)} in full`) : "Enter a valid amount"}
          </button>
        ) : (
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                run(async () => {
                  const r = await issueRefund(order.id, amt, reason);
                  if (r.ok) setDoneMsg(`Refunded ${fmt(amt)} - reference ${r.refundId ?? "created"}. Receipt emailed to ${order.email}.`);
                  return r;
                });
              }}
              style={{ background: "#B43A16", color: "#fff", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, border: "none", cursor: "pointer" }}
            >
              Confirm: send {fmt(amt)} back to the customer
            </button>
            <button onClick={() => setConfirming(false)} style={{ background: "none", border: "none", color: "#8A93A6", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </span>
        )}
      </div>
      <p style={{ fontSize: 11.5, color: doneMsg ? "#1F9D63" : "#A0A7B5", margin: "10px 0 0" }}>
        {doneMsg ?? "Money returns to the original payment method via Razorpay. The customer gets a receipt email with the refund reference. A full refund also cancels the order; a partial one leaves it in flight."}
      </p>
    </Card>
  );
}
