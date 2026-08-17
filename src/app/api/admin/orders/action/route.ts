import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { sendAccountInvite, sendWelcomeOffer, sendCustomerStatusUpdate, sendReplacementEmail, sendRefundVoucherEmail, sendRefundReceiptEmail } from "@/lib/email";
import { similarProducts } from "@/lib/admin/similar-products";
import { refundPayment } from "@/lib/razorpay";
import { baseExGst } from "@/lib/pricing";

/** Taxable value for an order's items at each item's own GST rate, scaled so
 *  subtotal + GST still equals the amount actually charged (this keeps any
 *  order-level discount correctly apportioned). */
function recomputeSubtotal(items: any[], total: number, shippingFee = 0): number {
  // `total` is the amount charged, which includes any flat shipping fee
  // (migration 0092). The GST split covers the GOODS alone, so shipping comes
  // out before scaling or it would be apportioned across the items as tax.
  const goodsTotal = Math.max(0, total - shippingFee);
  const gross = items.reduce((s, i) => s + baseExGst(Number(i.price), i.cat, i.gstRate) * Number(i.qty), 0);
  const lines = items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0);
  const scale = lines > 0 && goodsTotal > 0 ? goodsTotal / lines : 1;
  return Math.round(gross * scale * 100) / 100;
}
import {
  updateOrderStatus,
  cancelOrder,
  saveAdminNote,
  addShipment,
  markShipmentDelivered,
  uploadDeliveryProof,
  getShiprocketRates,
  shipViaShiprocket,
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
    case "metals-balance-received": {
      // A copper booking's RTGS balance landed in the bank: stamp it, log it,
      // and tell the customer dispatch is being scheduled.
      const db = adminClient();
      if (!db) { res = { ok: false, error: "Service key missing." }; break; }
      const orderId = String(body.orderId);
      const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!order) { res = { ok: false, error: "Order not found." }; break; }
      if (order.order_kind !== "metals_booking") { res = { ok: false, error: "Not a metals booking." }; break; }
      if (order.balance_received_at) { res = { ok: true }; break; } // already stamped - idempotent
      const { error } = await db.from("orders").update({ balance_received_at: new Date().toISOString() }).eq("id", orderId);
      if (error) { res = { ok: false, error: error.message }; break; }
      try { await db.from("order_events").insert({ order_id: orderId, status: order.status, note: `RTGS balance received in full (₹${Number(order.balance_due ?? 0).toLocaleString("en-IN")})` }); } catch { /* best-effort */ }
      await sendCustomerStatusUpdate(order, "confirmed", { note: "Your RTGS balance is received in full. The material is being scheduled for dispatch with the GST tax invoice." });
      res = { ok: true };
      break;
    }
    case "sr-rates": {
      const out = await getShiprocketRates({
        orderId: String(body.orderId),
        pickup: body.pickup ? String(body.pickup) : undefined,
        weightKg: Number(body.weightKg) || 1,
        lengthCm: Number(body.lengthCm) || undefined,
        breadthCm: Number(body.breadthCm) || undefined,
        heightCm: Number(body.heightCm) || undefined,
      });
      return NextResponse.json(out, { status: out.ok ? 200 : 400 });
    }
    case "sr-ship": {
      const out = await shipViaShiprocket({
        orderId: String(body.orderId),
        items: Array.isArray(body.items) ? body.items : [],
        pickup: String(body.pickup ?? ""),
        courierId: Number(body.courierId),
        courierName: String(body.courierName ?? ""),
        weightKg: Number(body.weightKg) || 1,
        lengthCm: Number(body.lengthCm) || 30,
        breadthCm: Number(body.breadthCm) || 25,
        heightCm: Number(body.heightCm) || 15,
      });
      return NextResponse.json(out, { status: out.ok ? 200 : 400 });
    }
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
      // Event log = the send history the admin buttons display. The phrasing
      // is load-bearing: OrderDetailClient matches on "Status email re-sent".
      if (sent.ok) { try { await db.from("order_events").insert({ order_id: order.id, status: order.status, note: `✉️ Status email re-sent (${order.status})` }); } catch { /* optional table */ } }
      res = sent.ok ? { ok: true } : { ok: false, error: "Email failed - check Resend logs." };
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
      // Send history (matched by OrderDetailClient on "Welcome offer emailed").
      if (sent.ok) { try { await db.from("order_events").insert({ order_id: order.id, status: order.status, note: `🎁 Welcome offer emailed · code ${code} (10%, 30 days)` }); } catch { /* optional table */ } }
      res = sent.ok ? { ok: true } : { ok: false, error: `Code ${code} created but the email failed - check Resend logs.` };
      break;
    }
    case "invite": {
      // Invite a guest-checkout customer to create an account for tracking.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("id, name, email, status").eq("id", String(body.orderId)).maybeSingle();
      if (!order?.email) return NextResponse.json({ ok: false, error: "Order or email not found." }, { status: 400 });
      const sent = await sendAccountInvite(order);
      // Send history (matched by OrderDetailClient on "Signup invite emailed").
      if (sent.ok) { try { await db.from("order_events").insert({ order_id: order.id, status: order.status ?? "placed", note: `✉️ Signup invite emailed` }); } catch { /* optional table */ } }
      res = sent.ok ? { ok: true } : { ok: false, error: "Email failed to send - check RESEND_API_KEY / logs." };
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
      // Swap in place and KEEP THE BILL EXACTLY AS PAID: same line price, same
      // order total, same payment. Only the taxable split can move, because
      // the replacement may sit at a different GST rate (a solar lantern is
      // 5% where a torch is 18%), so the subtotal is recomputed below.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 400 });
      const items: any[] = order.items ?? [];
      const idx = items.findIndex((x: any) => x.id === body.oldItemId);
      if (idx === -1) return NextResponse.json({ ok: false, error: "Item not found on this order." }, { status: 400 });
      const { data: np } = await db.from("products").select("id, name, elume_price, category, gst_rate, hsn").eq("id", String(body.newProductId)).eq("is_active", true).maybeSingle();
      if (!np) return NextResponse.json({ ok: false, error: "Replacement product not found or inactive (check the SKU/id)." }, { status: 400 });
      const old = items[idx];
      const next = [...items];
      next[idx] = {
        id: np.id, name: np.name, qty: old.qty,
        price: old.price, // the price the customer already paid - the bill does not move
        cat: np.category,
        ...(np.gst_rate != null ? { gstRate: Number(np.gst_rate) } : {}),
        ...(np.hsn ? { hsn: np.hsn } : {}),
      };
      const { error: upErr } = await db.from("orders").update({
        items: next,
        product_ids: next.map((x: any) => x.id),
        subtotal: recomputeSubtotal(next, Number(order.total ?? 0), Number(order.shipping_fee ?? 0)),
      }).eq("id", order.id);
      if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 400 });
      const listPrice = Number(np.elume_price);
      const note = listPrice > Number(old.price)
        ? `Replaced "${old.name}" with "${np.name}" (list ${listPrice}; price difference absorbed by Elume, bill unchanged)`
        : `Replaced "${old.name}" with "${np.name}" (list ${listPrice}; billed at the original ${old.price} as agreed, bill unchanged)`;
      try { await db.from("order_events").insert({ order_id: order.id, status: order.status, note }); } catch { /* optional */ }
      const sent = await sendReplacementEmail(order, old.name, { name: np.name, qty: old.qty, price: old.price }, "absorbed", { listPrice });
      res = { ok: true, ...(sent.ok ? {} : { error: "Swapped, but the email failed - check Resend logs." }) };
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
      const { data: np } = await db.from("products").select("id, name, elume_price, category, gst_rate, hsn").eq("id", String(body.newProductId)).eq("is_active", true).maybeSingle();
      if (!np) return NextResponse.json({ ok: false, error: "Replacement product not found or inactive (check the SKU/id)." }, { status: 400 });
      const old = items[idx];
      const next = [...items];
      next[idx] = {
        id: np.id, name: np.name, qty: old.qty,
        price: Number(np.elume_price), cat: np.category,
        ...(np.gst_rate != null ? { gstRate: Number(np.gst_rate) } : {}),
        ...(np.hsn ? { hsn: np.hsn } : {}),
      };
      const newTotal = Math.round(next.reduce((t: number, x: any) => t + Number(x.price) * Number(x.qty), 0) * 100) / 100;
      const d = new Date();
      const newId = `ELM-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: insErr } = await db.from("orders").insert({
        id: newId, email: order.email, name: order.name, phone: order.phone, gstin: order.gstin,
        billing_address: order.billing_address, shipping_address: order.shipping_address,
        payment_method: order.payment_method, items: next, product_ids: next.map((x: any) => x.id),
        subtotal: recomputeSubtotal(next, newTotal), total: newTotal, is_guest: order.is_guest, user_id: order.user_id,
        status: "placed", admin_note: `Replacement for ${order.id} ("${old.name}" discontinued). Payment carried from the original order - settle any difference manually.`,
      });
      if (insErr) return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });
      await db.from("orders").update({ status: "cancelled", admin_note: `Replaced in full by ${newId}` }).eq("id", order.id);
      try { await db.from("order_events").insert({ order_id: newId, status: "placed", note: `Created as replacement for ${order.id}` }); } catch { /* optional */ }
      const diff = Math.round((newTotal - Number(order.total ?? newTotal)) * 100) / 100;
      const sent = await sendReplacementEmail({ ...order, id: newId }, old.name, { name: np.name, qty: old.qty, price: Number(np.elume_price) }, "new-order", { newOrderId: newId, diff });
      res = { ok: true, ...(sent.ok ? {} : { error: `Order ${newId} created, but the email failed - check Resend logs.` }) };
      break;
    }
    case "refund": {
      // Order-level refund at an admin-chosen amount, with a branded receipt
      // email carrying the Razorpay references. Full refunds cancel the order;
      // partial refunds leave it in flight and just record the event.
      const db = adminClient();
      if (!db) return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 500 });
      const { data: order } = await db.from("orders").select("*").eq("id", String(body.orderId)).maybeSingle();
      if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 400 });
      if (!order.razorpay_payment_id) return NextResponse.json({ ok: false, error: "No captured payment on file - refund manually in Razorpay first." }, { status: 400 });
      const amount = Math.round(Number(body.amount) * 100) / 100;
      const total = Number(order.total ?? 0);
      if (!(amount > 0)) return NextResponse.json({ ok: false, error: "Enter a refund amount above zero." }, { status: 400 });
      if (amount > total) return NextResponse.json({ ok: false, error: `Amount exceeds the order total (${total}).` }, { status: 400 });
      const reason = String(body.reason ?? "").trim() || undefined;

      const refund = await refundPayment(order.razorpay_payment_id, Math.round(amount * 100));
      if (!refund.ok) return NextResponse.json({ ok: false, error: `Razorpay refused the refund: ${refund.error}` }, { status: 400 });

      const partial = amount < total;
      try {
        await db.from("order_events").insert({
          order_id: order.id, status: partial ? order.status : "cancelled",
          note: `Refunded ${amount} via Razorpay (${refund.refundId})${reason ? ` - ${reason}` : ""}`,
        });
      } catch { /* optional */ }
      if (!partial) {
        await db.from("orders").update({ status: "cancelled", cancel_reason: reason ?? `Refunded in full (${refund.refundId})` }).eq("id", order.id);
      }
      const sent = await sendRefundReceiptEmail(order, { amount, refundId: refund.refundId ?? "", paymentId: order.razorpay_payment_id, reason, partial });
      return NextResponse.json({ ok: true, refundId: refund.refundId, ...(sent.ok ? {} : { error: "Refunded, but the receipt email failed - check Resend logs." }) });
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
      if (!order.razorpay_payment_id) return NextResponse.json({ ok: false, error: "No captured payment on file for this order - refund manually in Razorpay first." }, { status: 400 });
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
      res = { ok: true, ...(sent.ok ? {} : { error: `Refund done (${refund.refundId}), but the email failed - check Resend logs.` }) };
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
