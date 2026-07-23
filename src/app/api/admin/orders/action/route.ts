import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { sendAccountInvite, sendWelcomeOffer, sendCustomerStatusUpdate, sendReplacementEmail, sendRefundVoucherEmail } from "@/lib/email";
import { similarProducts } from "@/lib/admin/similar-products";
import { refundPayment } from "@/lib/razorpay";
import {
  updateOrderStatus,
  cancelOrder,
  saveAdminNote,
  addShipment,
  markShipmentDelivered,
  uploadDeliveryProof,
  type OrderStatus,
} from "@/lib/admin/order-actions";

/**
 * Admin order mutations over a PLAIN route instead of server actions.
 *
 * Why: server-action ids rotate on every deployment, and this project deploys
 * many times a day. Any admin tab opened before a push threw on the next
 * click ("The site was updated while this page was open") even in a fresh
 * browser, because a deploy landed between page load and click. A fetch to a
 * fixed URL survives deployments; confirm/cancel now always work.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: OrderStatus[] = ["confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin. Reload and enter the admin password." }, { status: 401 });

  // Delivery-proof uploads arrive as multipart form-data; everything else is JSON.
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("multipart/form-data")) {
    const res = await uploadDeliveryProof(await request.formData());
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  }

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  const op = String(body?.op ?? "");
  let res: { ok: boolean; error?: string };
  switch (op) {
    case "status": {
      const st = String(body.status) as OrderStatus;
      if (!STATUSES.includes(st)) return NextResponse.json({ ok: false, error: "Unknown status." }, { status: 400 });
      res = await updateOrderStatus(String(body.orderId), st, body.note ? String(body.note) : undefined);
      break;
    }
    case "cancel":
      res = await cancelOrder(String(body.orderId), String(body.reason ?? ""));
      break;
    case "note":
      res = await saveAdminNote(String(body.orderId), String(body.note ?? ""));
      break;
    case "shipment":
      res = await addShipment({
        order_id: String(body.order_id),
        courier: String(body.courier ?? ""),
        awb: String(body.awb ?? ""),
        tracking_url: body.tracking_url ? String(body.tracking_url) : undefined,
        items: Array.isArray(body.items) ? body.items : [],
      });
      break;
    case "notify": {
      // Resend the email for the order's CURRENT status (e.g. a confirmation
      // that never went out while the email domain was unverified).
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order?.email) return NextResponse.json({ ok: false, error: "Order or email not found." }, { status: 400 });
      const sent = await sendCustomerStatusUpdate(order, order.status);
      res = sent.ok ? { ok: true } : { ok: false, error: "Email failed — check Resend logs." };
      break;
    }
    case "welcome-offer": {
      // One-time personal discount for a first order: create the code, then
      // send confirmation + code + account nudge in one email.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order?.email) return NextResponse.json({ ok: false, error: "Order or email not found." }, { status: 400 });
      const percent = 10;
      const expires = new Date(Date.now() + 30 * 86_400_000);
      const code = `ELUME10-${String(body.orderId).slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
      const { error: insErr } = await db.from("discount_codes").insert({
        code, percent, email_lock: order.email.toLowerCase(), expires_at: expires.toISOString(),
        max_uses: 1, note: `Welcome offer · order ${order.id}`,
      });
      if (insErr) return NextResponse.json({ ok: false, error: `Couldn't create the code: ${insErr.message} (run migration 0056?)` }, { status: 400 });
      const sent = await sendWelcomeOffer(order, code, percent, expires);
      res = sent.ok ? { ok: true } : { ok: false, error: `Code ${code} created but the email failed — check Resend logs.` };
      break;
    }
    case "invite": {
      // Invite a guest-checkout customer to create an account for tracking.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("id, name, email").eq("id", String(body.orderId)).maybeSingle();
      if (!order?.email) return NextResponse.json({ ok: false, error: "Order or email not found." }, { status: 400 });
      const sent = await sendAccountInvite(order);
      res = sent.ok ? { ok: true } : { ok: false, error: "Email failed to send — check RESEND_API_KEY / logs." };
      break;
    }
    case "similar": {
      // Suggest live replacements for an order item (works even when the
      // original product has been deleted from the catalogue).
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("items").eq("id", String(body.orderId)).maybeSingle();
      const it = (order?.items ?? []).find((x: any) => x.id === body.itemId || x.name === body.itemName);
      if (!it) return NextResponse.json({ ok: false, error: "Item not found on this order." }, { status: 400 });
      const suggestions = await similarProducts({ name: it.name, cat: it.cat ?? null, price: it.price ?? null }, 6);
      return NextResponse.json({ ok: true, item: { id: it.id, name: it.name, qty: it.qty, price: it.price }, suggestions });
    }
    case "replace-item": {
      // Swap in place, WE absorb any price difference — the customer's total
      // and payment stay untouched.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 400 });
      const items: any[] = order.items ?? [];
      const idx = items.findIndex((x: any) => x.id === body.oldItemId);
      if (idx === -1) return NextResponse.json({ ok: false, error: "Item not found on this order." }, { status: 400 });
      const { data: np } = await db.from("products").select("id, name, elume_price, category").eq("id", String(body.newProductId)).eq("is_active", true).maybeSingle();
      if (!np) return NextResponse.json({ ok: false, error: "Replacement product not found or inactive (check the SKU/id)." }, { status: 400 });
      const old = items[idx];
      const next = [...items];
      next[idx] = { id: np.id, name: np.name, qty: old.qty, price: old.price, cat: np.category }; // old price kept — burden ours
      const { error: upErr } = await db.from("orders").update({ items: next, product_ids: next.map((x: any) => x.id) }).eq("id", order.id);
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      try { await db.from("order_events").insert({ order_id: order.id, status: order.status, note: `Replaced "${old.name}" with "${np.name}" (price difference absorbed by Elume)` }); } catch { /* optional */ }
      const sent = await sendReplacementEmail(order, old.name, { name: np.name, qty: old.qty, price: old.price }, "absorbed");
      res = { ok: true, ...(sent.ok ? {} : { error: "Swapped, but the email failed — check Resend logs." }) };
      break;
    }
    case "replace-order": {
      // Full replacement PO: new order at CURRENT pricing, original cancelled.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 400 });
      const items: any[] = order.items ?? [];
      const idx = items.findIndex((x: any) => x.id === body.oldItemId);
      if (idx === -1) return NextResponse.json({ ok: false, error: "Item not found on this order." }, { status: 400 });
      const { data: np } = await db.from("products").select("id, name, elume_price, category").eq("id", String(body.newProductId)).eq("is_active", true).maybeSingle();
      if (!np) return NextResponse.json({ ok: false, error: "Replacement product not found or inactive (check the SKU/id)." }, { status: 400 });
      const old = items[idx];
      const next = [...items];
      next[idx] = { id: np.id, name: np.name, qty: old.qty, price: Number(np.elume_price), cat: np.category };
      const newTotal = Math.round(next.reduce((t: number, x: any) => t + Number(x.price) * Number(x.qty), 0) * 100) / 100;
      const d = new Date();
      const newId = `ELM-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: insErr } = await db.from("orders").insert({
        id: newId, email: order.email, name: order.name, phone: order.phone, gstin: order.gstin,
        billing_address: order.billing_address, shipping_address: order.shipping_address,
        payment_method: order.payment_method, items: next, product_ids: next.map((x: any) => x.id),
        subtotal: order.subtotal, total: newTotal, is_guest: order.is_guest, user_id: order.user_id,
        status: "placed", admin_note: `Replacement for ${order.id} ("${old.name}" discontinued). Payment carried from the original order — settle any difference manually.`,
      });
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      await db.from("orders").update({ status: "cancelled", admin_note: `Replaced in full by ${newId}` }).eq("id", order.id);
      try { await db.from("order_events").insert({ order_id: newId, status: "placed", note: `Created as replacement for ${order.id}` }); } catch { /* optional */ }
      const diff = Math.round((newTotal - Number(order.total ?? newTotal)) * 100) / 100;
      const sent = await sendReplacementEmail({ ...order, id: newId }, old.name, { name: np.name, qty: old.qty, price: Number(np.elume_price) }, "new-order", { newOrderId: newId, diff });
      res = { ok: true, ...(sent.ok ? {} : { error: `Order ${newId} created, but the email failed — check Resend logs.` }) };
      break;
    }
    case "refund-item": {
      // Item refund to the original payment method + a 10% apology voucher.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order?.email) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 400 });
      const it = (order.items ?? []).find((x: any) => x.id === body.itemId);
      if (!it) return NextResponse.json({ ok: false, error: "Item not found on this order." }, { status: 400 });
      if (!order.razorpay_payment_id) return NextResponse.json({ ok: false, error: "No captured payment on file for this order — refund manually in Razorpay first." }, { status: 400 });
      const amount = Math.round(Number(it.price) * Number(it.qty) * 100) / 100;
      const refund = await refundPayment(order.razorpay_payment_id, Math.round(amount * 100));
      if (!refund.ok) return NextResponse.json({ ok: false, error: `Razorpay refund failed: ${refund.error}` }, { status: 400 });
      const expires = new Date(Date.now() + 30 * 86_400_000);
      const code = `SORRY10-${String(order.id).slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
      await db.from("discount_codes").insert({ code, percent: 10, email_lock: order.email.toLowerCase(), expires_at: expires.toISOString(), max_uses: 1, note: `Unavailable-item apology · order ${order.id}` });
      const remaining = (order.items ?? []).filter((x: any) => x.id !== it.id);
      await db.from("orders").update({
        items: remaining, product_ids: remaining.map((x: any) => x.id),
        total: Math.round((Number(order.total ?? 0) - amount) * 100) / 100,
        ...(remaining.length === 0 ? { status: "cancelled" } : {}),
      }).eq("id", order.id);
      try { await db.from("order_events").insert({ order_id: order.id, status: remaining.length ? order.status : "cancelled", note: `Refunded ${it.name} (₹${amount}, refund ${refund.refundId}) + voucher ${code}` }); } catch { /* optional */ }
      const sent = await sendRefundVoucherEmail(order, it.name, amount, code, expires);
      res = { ok: true, ...(sent.ok ? {} : { error: `Refund done (${refund.refundId}), but the email failed — check Resend logs.` }) };
      break;
    }
    case "deliver":
      res = await markShipmentDelivered(String(body.shipmentId), String(body.orderId), body.proofUrl ? String(body.proofUrl) : undefined);
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
