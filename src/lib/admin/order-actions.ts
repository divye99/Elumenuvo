"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/auth";
import { sendCustomerStatusUpdate } from "@/lib/email";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Safety net for every order action: an uncaught throw inside a server
 *  action replaces the whole admin page with Next's opaque "Application
 *  error … Digest" screen. Wrapping guarantees the worst case is a readable
 *  inline message instead, with the real cause logged server-side. */
async function safely(label: string, fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[order-action:${label}]`, e);
    return { ok: false, error: `${label} failed: ${msg}` };
  }
}

// Linear status flow (partial_shipped is set automatically by shipment logic).
const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
const OPEN_STATUSES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery"];

const STAMP: Record<string, string> = { confirmed: "confirmed_at", delivered: "delivered_at", cancelled: "cancelled_at" };

async function guard() {
  if (!(await isAdmin())) return { db: null, err: "Not signed in." as const };
  const db = adminClient();
  if (!db) return { db: null, err: "Service-role key missing - writes disabled." as const };
  return { db, err: null };
}

async function loadOrder(db: any, orderId: string) {
  const { data } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  return data;
}

/** Update an order, tolerating schema drift: if the live table is missing an
 *  optional column (Postgres 42703), retry with the minimal status-only patch
 *  rather than failing the whole action. Returns an error message or null. */
async function patchOrder(db: any, orderId: string, patch: Record<string, any>): Promise<string | null> {
  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  if (!error) return null;
  if (error.code === "42703" && patch.status) {
    const retry = await db.from("orders").update({ status: patch.status }).eq("id", orderId);
    if (!retry.error) return null;
    return retry.error.message;
  }
  return error.message;
}

/** Event log + customer email are best-effort: they must never fail the action. */
async function logAndNotify(db: any, order: any, status: string, note?: string | null, extra?: any) {
  try { await db.from("order_events").insert({ order_id: order.id, status, note: note || null }); } catch { /* optional table */ }
  try { if (order.email) await sendCustomerStatusUpdate(order, status, { note, ...extra }); } catch (e) { console.warn("[order-email]", e instanceof Error ? e.message : e); }
}

/** Advance an order to a new status: stamp, log an event, notify the customer. */
async function _updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const order = await loadOrder(db, orderId);
  if (!order) return { ok: false, error: "Order not found." };

  const patch: Record<string, any> = { status, updated_at: new Date().toISOString() };
  if (STAMP[status]) patch[STAMP[status]] = new Date().toISOString();
  const failed = await patchOrder(db, orderId, patch);
  if (failed) return { ok: false, error: failed };

  await logAndNotify(db, order, status, note);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

async function _cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const order = await loadOrder(db, orderId);
  if (!order) return { ok: false, error: "Order not found." };
  const failed = await patchOrder(db, orderId, { status: "cancelled", cancelled_at: new Date().toISOString(), cancel_reason: reason || null, updated_at: new Date().toISOString() });
  if (failed) return { ok: false, error: failed };
  await logAndNotify(db, order, "cancelled", reason);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

async function _saveAdminNote(orderId: string, note: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const { error } = await db.from("orders").update({ admin_note: note || null, updated_at: new Date().toISOString() }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

type ShipmentInput = {
  order_id: string;
  courier: string;
  awb: string;
  tracking_url?: string;
  items: { id: string; name: string; qty: number }[];
};

/** Record a parcel (partial shipment), set order status, notify the customer. */
async function _addShipment(input: ShipmentInput): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const order = await loadOrder(db, input.order_id);
  if (!order) return { ok: false, error: "Order not found." };
  if (!input.courier.trim() || !input.awb.trim()) return { ok: false, error: "Courier and AWB are required." };

  const nowIso = new Date().toISOString();
  const { error } = await db.from("order_shipments").insert({
    order_id: input.order_id, courier: input.courier.trim(), awb: input.awb.trim(),
    tracking_url: input.tracking_url?.trim() || null, items: input.items ?? [], status: "shipped", shipped_at: nowIso,
  });
  if (error) return { ok: false, error: error.message };

  // Fully vs partially shipped: compare shipped qty against the order's items.
  const { data: shipments } = await db.from("order_shipments").select("items").eq("order_id", input.order_id);
  const shippedQty = sumQty((shipments ?? []).flatMap((s: any) => s.items ?? []));
  const orderedQty = sumQty(order.items ?? []);
  const status = orderedQty > 0 && shippedQty >= orderedQty ? "shipped" : "partially_shipped";

  await db.from("orders").update({ status, updated_at: nowIso }).eq("id", input.order_id);
  await db.from("order_events").insert({ order_id: input.order_id, status, note: `Shipped via ${input.courier.trim()} · AWB ${input.awb.trim()}` });
  await sendCustomerStatusUpdate(order, status, { courier: input.courier.trim(), awb: input.awb.trim(), tracking_url: input.tracking_url });
  revalidatePath(`/admin/orders/${input.order_id}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

/** Mark a parcel delivered (optionally with a proof image); roll up to the order. */
async function _markShipmentDelivered(shipmentId: string, orderId: string, proofUrl?: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const nowIso = new Date().toISOString();
  const { error } = await db.from("order_shipments").update({ status: "delivered", delivered_at: nowIso, proof_url: proofUrl || null }).eq("id", shipmentId);
  if (error) return { ok: false, error: error.message };

  const { data: shipments } = await db.from("order_shipments").select("status").eq("order_id", orderId);
  const allDelivered = (shipments ?? []).length > 0 && (shipments ?? []).every((s: any) => s.status === "delivered");
  const order = await loadOrder(db, orderId);
  if (allDelivered) {
    await db.from("orders").update({ status: "delivered", delivered_at: nowIso, updated_at: nowIso }).eq("id", orderId);
    await db.from("order_events").insert({ order_id: orderId, status: "delivered", note: "All parcels delivered" });
    if (order) await sendCustomerStatusUpdate(order, "delivered");
  } else {
    await db.from("order_events").insert({ order_id: orderId, status: "out_for_delivery", note: "A parcel was delivered" });
  }
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

/** Upload a delivery-proof photo to Storage; returns its public URL. */
export async function uploadDeliveryProof(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    return await _uploadDeliveryProof(fd);
  } catch (e) {
    console.error("[order-action:upload-proof]", e);
    return { ok: false, error: `Upload failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function _uploadDeliveryProof(fd: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const file = fd.get("file") as File | null;
  const orderId = String(fd.get("order_id") || "");
  if (!file || file.size === 0) return { ok: false, error: "No file." };
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${orderId}/${Date.now()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error } = await db.storage.from("delivery-proofs").upload(path, buf, { contentType: file.type || "image/jpeg", upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: db.storage.from("delivery-proofs").getPublicUrl(path).data.publicUrl };
}

function sumQty(items: { qty?: number }[]): number {
  return items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
}


export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult> {
  return safely("Status update", () => _updateOrderStatus(orderId, status, note));
}
export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
  return safely("Cancel", () => _cancelOrder(orderId, reason));
}
export async function saveAdminNote(orderId: string, note: string): Promise<ActionResult> {
  return safely("Saving the note", () => _saveAdminNote(orderId, note));
}
export async function addShipment(input: ShipmentInput): Promise<ActionResult> {
  return safely("Adding the shipment", () => _addShipment(input));
}

/* ── Shiprocket booking (lib/shiprocket.ts does the API legwork) ── */

import { getRates, shipOrder, pickupLocations, parseAddress, walletBalance, type CourierOption, type PickupLocation } from "@/lib/shiprocket";
import { pinDistanceKm } from "@/lib/geo";

export type SrRatesResult =
  | { ok: true; couriers: CourierOption[]; pickups: PickupLocation[]; pickup: string; deliveryPin: string; balance: number | null; distanceKm: number | null }
  | { ok: false; error: string };

/** Live courier options for one order at the entered weight/dimensions. */
export async function getShiprocketRates(input: {
  orderId: string; pickup?: string; weightKg: number;
  lengthCm?: number; breadthCm?: number; heightCm?: number;
}): Promise<SrRatesResult> {
  try {
    const { db, err } = await guard();
    if (!db) return { ok: false, error: err };
    const order = await loadOrder(db, input.orderId);
    if (!order) return { ok: false, error: "Order not found." };

    const s = order.address_details?.shipping;
    const deliveryPin: string = s?.pin?.trim() || parseAddress(order.shipping_address ?? "").pincode;
    if (!/^\d{6}$/.test(deliveryPin)) return { ok: false, error: "No 6-digit delivery PIN on this order - fix the address first." };

    const pickups = await pickupLocations();
    if (!pickups.length) return { ok: false, error: "No pickup locations registered in Shiprocket." };
    const pickup = pickups.find((p) => p.name === input.pickup) ?? pickups.find((p) => /warehouse/i.test(p.name)) ?? pickups[0];

    const [couriers, balance] = await Promise.all([
      getRates({
        pickupPin: pickup.pin, deliveryPin, weightKg: input.weightKg,
        lengthCm: input.lengthCm, breadthCm: input.breadthCm, heightCm: input.heightCm,
        cod: false, declaredValue: Number(order.total ?? 0) || undefined,
      }),
      walletBalance(),
    ]);

    // Rate intelligence: log EVERY option shown, not just the pick (0119).
    // This is the raw dataset for per-lane courier analysis - who is really
    // cheapest/fastest to which state at which weight - and later, learned
    // recommendations scored against actual delivery outcomes.
    const distanceKm = pinDistanceKm(pickup.pin, deliveryPin);
    try {
      const state = s?.state?.trim() || parseAddress(order.shipping_address ?? "").state || null;
      const vol = input.lengthCm && input.breadthCm && input.heightCm
        ? Math.round((input.lengthCm * input.breadthCm * input.heightCm) / 5000 * 100) / 100 : null;
      const toDate = (d: string | null) => { const t = d ? new Date(d) : null; return t && !isNaN(t.getTime()) ? t.toISOString().slice(0, 10) : null; };
      await db.from("courier_quotes").insert(couriers.map((c) => ({
        order_id: input.orderId, pickup_location: pickup.name, pickup_pin: pickup.pin,
        delivery_pin: deliveryPin, delivery_state: state, distance_km: distanceKm,
        dead_weight_kg: input.weightKg, vol_weight_kg: vol, charge_weight_kg: c.chargeWeightKg,
        courier_id: c.courierId, courier_name: c.name, mode: c.mode,
        rate: c.rate, etd: toDate(c.etd), est_days: c.estimatedDays || null, pickup_date: toDate(c.pickupDate),
        rating: c.rating, pickup_rating: c.pickupRating, delivery_rating: c.deliveryRating,
      })));
    } catch { /* pre-0119/0120 or transient - never block the panel */ }

    return { ok: true, couriers, pickups, pickup: pickup.name, deliveryPin, balance, distanceKm };
  } catch (e) {
    console.error("[order-action:sr-rates]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type SrShipResult =
  | { ok: true; awb: string; courierName: string; freight: number | null; labelUrl: string | null; pickupScheduled: boolean }
  | { ok: false; error: string };

/** Book the parcel on Shiprocket (order -> AWB -> pickup -> label), record the
 *  shipment with full telemetry, roll the order status and email the customer -
 *  the automated twin of _addShipment. */
/** Shiprocket document URLs (label / SR invoice / manifest) for a booked
 *  shipment row. Kept separate from our own proforma/tax invoice engine. */
export async function getSrDocuments(input: { orderId: string; shipmentId?: string }): Promise<
  { ok: true; label: string | null; invoice: string | null; manifest: string | null } | { ok: false; error: string }
> {
  const db = adminClient();
  if (!db) return { ok: false, error: "Server storage unavailable." };
  let qy = db.from("order_shipments").select("id, sr_order_id, sr_shipment_id").eq("order_id", input.orderId).not("sr_shipment_id", "is", null).order("created_at", { ascending: false });
  if (input.shipmentId) qy = qy.eq("id", input.shipmentId);
  const { data } = await qy.limit(1);
  const row = data?.[0];
  if (!row?.sr_order_id || !row?.sr_shipment_id) return { ok: false, error: "This shipment wasn't booked through Shiprocket." };
  try {
    const { srDocuments } = await import("@/lib/shiprocket");
    const docs = await srDocuments(Number(row.sr_order_id), Number(row.sr_shipment_id));
    if (!docs.label && !docs.invoice && !docs.manifest) return { ok: false, error: "Shiprocket returned no documents yet - try again in a minute." };
    return { ok: true, ...docs };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Shiprocket document fetch failed." };
  }
}

export async function shipViaShiprocket(input: {
  orderId: string;
  items: { id: string; name: string; qty: number }[];
  pickup: string; courierId: number; courierName: string;
  weightKg: number; lengthCm: number; breadthCm: number; heightCm: number;
}): Promise<SrShipResult> {
  try {
    const { db, err } = await guard();
    if (!db) return { ok: false, error: err };
    const order = await loadOrder(db, input.orderId);
    if (!order) return { ok: false, error: "Order not found." };
    if (!input.items.length) return { ok: false, error: "Pick at least one item for the parcel." };

    const booked = await shipOrder({
      order, items: input.items, pickupLocation: input.pickup, courierId: input.courierId,
      weightKg: input.weightKg, lengthCm: input.lengthCm, breadthCm: input.breadthCm, heightCm: input.heightCm,
    });

    const nowIso = new Date().toISOString();
    const trackingUrl = `https://shiprocket.co/tracking/${booked.awb}`;
    const courier = booked.courierName || input.courierName;
    const row: Record<string, unknown> = {
      order_id: input.orderId, courier, awb: booked.awb, tracking_url: trackingUrl,
      items: input.items, status: "shipped", shipped_at: nowIso,
      // Telemetry (migration 0113) - stripped on retry for pre-0113 databases.
      sr_order_id: booked.srOrderId, sr_shipment_id: booked.srShipmentId, courier_id: input.courierId,
      freight_charge: booked.freight, entered_weight_kg: input.weightKg,
      dims_cm: `${input.lengthCm}x${input.breadthCm}x${input.heightCm}`,
      manifest_at: nowIso, sr_status: "manifested", label_url: booked.labelUrl, pickup_location: input.pickup,
    };
    let { error } = await db.from("order_shipments").insert(row);
    if (error && error.code === "42703") {
      for (const k of ["sr_order_id", "sr_shipment_id", "courier_id", "freight_charge", "entered_weight_kg", "dims_cm", "manifest_at", "sr_status", "label_url", "pickup_location"]) delete row[k];
      ({ error } = await db.from("order_shipments").insert(row));
    }
    if (error) return { ok: false, error: `Booked on Shiprocket (AWB ${booked.awb}) but recording failed: ${error.message}` };

    const { data: shipments } = await db.from("order_shipments").select("items").eq("order_id", input.orderId);
    const shippedQty = sumQty((shipments ?? []).flatMap((s: any) => s.items ?? []));
    const orderedQty = sumQty(order.items ?? []);
    const status = orderedQty > 0 && shippedQty >= orderedQty ? "shipped" : "partially_shipped";
    await db.from("orders").update({ status, updated_at: nowIso }).eq("id", input.orderId);
    try {
      await db.from("order_events").insert({
        order_id: input.orderId, status,
        note: `Shipped via ${courier} · AWB ${booked.awb}${booked.freight != null ? ` · freight ₹${booked.freight}` : ""} (Shiprocket)`,
      });
    } catch { /* optional table */ }
    try { await sendCustomerStatusUpdate(order, status, { courier, awb: booked.awb, tracking_url: trackingUrl }); } catch (e) { console.warn("[sr-ship email]", e); }
    // Mark this courier's quote rows as the chosen ones (rate intelligence).
    try { await db.from("courier_quotes").update({ chosen: true }).eq("order_id", input.orderId).eq("courier_id", input.courierId); } catch { /* pre-0119 */ }

    revalidatePath(`/admin/orders/${input.orderId}`);
    revalidatePath("/admin/orders");
    return { ok: true, awb: booked.awb, courierName: courier, freight: booked.freight, labelUrl: booked.labelUrl, pickupScheduled: booked.pickupScheduled };
  } catch (e) {
    console.error("[order-action:sr-ship]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
export async function markShipmentDelivered(shipmentId: string, orderId: string, proofUrl?: string): Promise<ActionResult> {
  return safely("Marking delivered", () => _markShipmentDelivered(shipmentId, orderId, proofUrl));
}

/* ── Delivery issues (migration 0126): failed delivery / RTO workflow ── */

export type DeliveryIssueInput = {
  orderId: string;
  shipmentId?: string | null;
  kind: string;            // undelivered | rto | address_issue | refused | not_reachable | damaged | lost | other
  fault: string;           // buyer | courier | ops | unknown
  reason: string;          // exact reason, in words
  courier?: string | null; // scorecard snapshot
  awb?: string | null;
  redeliveryFee: number;   // 0 = free
  feeNote?: string | null; // customer-facing framing of the fee (or the free)
  notifyCustomer: boolean; // send the decision email now
};

async function _reportDeliveryIssue(input: DeliveryIssueInput): Promise<{ ok: true; decisionUrl: string } | { ok: false; error: string }> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const order = await loadOrder(db, input.orderId);
  if (!order) return { ok: false, error: "Order not found." };
  const reason = (input.reason ?? "").trim();
  if (!reason) return { ok: false, error: "Write the exact reason - it drives the courier scorecard." };

  const { randomBytes } = await import("crypto");
  const token = randomBytes(18).toString("base64url");
  const { error } = await db.from("delivery_issues").insert({
    order_id: input.orderId,
    shipment_id: input.shipmentId ?? null,
    kind: input.kind,
    fault: input.fault,
    reason: reason.slice(0, 600),
    courier: input.courier ?? null,
    awb: input.awb ?? null,
    redelivery_fee: Math.max(0, Number(input.redeliveryFee) || 0),
    fee_note: (input.feeNote ?? "").slice(0, 300) || null,
    status: input.notifyCustomer ? "awaiting_customer" : "open",
    decision_token: token,
  });
  if (error) return { ok: false, error: error.code === "42P01" ? "Run migration 0126 (delivery_issues) first." : error.message };

  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://elumenuvo.com").replace(/\/+$/, "");
  const decisionUrl = `${site}/delivery/${token}`;
  try { await db.from("order_events").insert({ order_id: input.orderId, status: "delivery_issue", note: `Delivery failed (${input.kind}, ${input.fault} fault): ${reason.slice(0, 200)}` }); } catch { /* optional */ }
  if (input.notifyCustomer && order.email) {
    const { sendDeliveryIssueEmail } = await import("@/lib/email");
    try {
      await sendDeliveryIssueEmail(order, { reason, redeliveryFee: Math.max(0, Number(input.redeliveryFee) || 0), feeNote: input.feeNote, decisionUrl });
    } catch (e) { console.warn("[delivery-issue email]", e instanceof Error ? e.message : e); }
  }
  revalidatePath(`/admin/orders/${input.orderId}`);
  return { ok: true, decisionUrl };
}

export async function reportDeliveryIssue(input: DeliveryIssueInput): Promise<{ ok: true; decisionUrl: string } | { ok: false; error: string }> {
  try { return await _reportDeliveryIssue(input); } catch (e) {
    console.error("[order-action:delivery-issue]", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Move an issue through its lifecycle: redelivery_booked / resolved /
 *  cancelled. Resolution notes land in the order timeline. */
async function _setDeliveryIssueStatus(issueId: string, orderId: string, status: "redelivery_booked" | "resolved" | "cancelled", note?: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const patch: Record<string, any> = { status };
  if (status === "resolved" || status === "cancelled") patch.resolved_at = new Date().toISOString();
  const { error } = await db.from("delivery_issues").update(patch).eq("id", issueId);
  if (error) return { ok: false, error: error.message };
  try { await db.from("order_events").insert({ order_id: orderId, status: "delivery_issue", note: note || `Delivery issue ${status.replace(/_/g, " ")}` }); } catch { /* optional */ }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function setDeliveryIssueStatus(issueId: string, orderId: string, status: "redelivery_booked" | "resolved" | "cancelled", note?: string): Promise<ActionResult> {
  return safely("Updating delivery issue", () => _setDeliveryIssueStatus(issueId, orderId, status, note));
}

/** Apply the customer's corrected address to the order itself, so the next
 *  booking (Shiprocket panel reads the order address) ships to the right
 *  place. Explicit button in the issue panel - never automatic. */
async function _applyIssueAddress(issueId: string, orderId: string): Promise<ActionResult> {
  const { db, err } = await guard();
  if (!db) return { ok: false, error: err };
  const { data: issue } = await db.from("delivery_issues").select("new_address").eq("id", issueId).maybeSingle();
  if (!issue?.new_address) return { ok: false, error: "No corrected address on this issue." };
  const failed = await patchOrder(db, orderId, { shipping_address: issue.new_address, updated_at: new Date().toISOString() });
  if (failed) return { ok: false, error: failed };
  try { await db.from("order_events").insert({ order_id: orderId, status: "delivery_issue", note: `Shipping address replaced with the customer's corrected address (delivery issue).` }); } catch { /* optional */ }
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function applyIssueAddress(issueId: string, orderId: string): Promise<ActionResult> {
  return safely("Applying corrected address", () => _applyIssueAddress(issueId, orderId));
}
