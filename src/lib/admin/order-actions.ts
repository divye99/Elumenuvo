"use server";

import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/auth";
import { sendCustomerStatusUpdate } from "@/lib/email";

export type ActionResult = { ok: true } | { ok: false; error: string };

// Linear status flow (partial_shipped is set automatically by shipment logic).
export const ORDER_STATUSES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const OPEN_STATUSES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery"];

const STAMP: Record<string, string> = { confirmed: "confirmed_at", delivered: "delivered_at", cancelled: "cancelled_at" };

async function guard() {
  if (!(await isAdmin())) return { db: null, err: "Not signed in." as const };
  const db = adminClient();
  if (!db) return { db: null, err: "Service-role key missing — writes disabled." as const };
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
export async function updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Promise<ActionResult> {
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

export async function cancelOrder(orderId: string, reason: string): Promise<ActionResult> {
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

export async function saveAdminNote(orderId: string, note: string): Promise<ActionResult> {
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
export async function addShipment(input: ShipmentInput): Promise<ActionResult> {
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
export async function markShipmentDelivered(shipmentId: string, orderId: string, proofUrl?: string): Promise<ActionResult> {
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
