import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { sendAccountInvite, sendWelcomeOffer, sendCustomerStatusUpdate } from "@/lib/email";
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
    case "deliver":
      res = await markShipmentDelivered(String(body.shipmentId), String(body.orderId), body.proofUrl ? String(body.proofUrl) : undefined);
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
