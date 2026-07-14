import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, webhookConfigured } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/order-actions";

/**
 * Razorpay webhook — the safety net for online payments.
 *
 * The browser callback (confirmOnlinePayment) is the fast path, but it never
 * runs if the customer closes the tab, loses signal, or app-switches mid-UPI.
 * Razorpay still took their money. This endpoint hears about the payment
 * server-to-server and marks the order paid regardless, so nobody is ever
 * charged without an order.
 *
 * Both paths call the same idempotent markOrderPaid(), which only acts while
 * the order is `awaiting_payment` — so a double-delivery can't double-email.
 *
 * Setup: Razorpay Dashboard → Settings → Webhooks
 *   URL:    https://elumenuvo.com/api/razorpay/webhook
 *   Events: payment.captured  (order.paid is also accepted)
 *   Secret: must equal RAZORPAY_WEBHOOK_SECRET in the environment.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // needs node crypto for HMAC

export async function POST(request: Request) {
  if (!webhookConfigured()) {
    // Nothing to verify against — refuse rather than trust an unsigned payload.
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  // The signature is over the RAW bytes; re-serialising the JSON would break it.
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON." }, { status: 400 });
  }

  const type: string = event?.event ?? "";
  // We only care about money actually captured.
  if (type !== "payment.captured" && type !== "order.paid") {
    return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
  }

  const payment = event?.payload?.payment?.entity ?? {};
  const razorpayOrderId: string = payment.order_id ?? event?.payload?.order?.entity?.id ?? "";
  const razorpayPaymentId: string = payment.id ?? "";
  // We stamped our own order id into the Razorpay order's notes at creation.
  const ourOrderId: string =
    payment?.notes?.orderId ?? event?.payload?.order?.entity?.notes?.orderId ?? "";

  if (!razorpayOrderId || !razorpayPaymentId) {
    return NextResponse.json({ ok: true, ignored: "missing ids" }, { status: 200 });
  }

  const db = adminClient();
  if (!db) {
    // Transient on our side — 500 makes Razorpay retry rather than drop it.
    return NextResponse.json({ error: "Database unavailable." }, { status: 500 });
  }

  // Prefer the notes order id; fall back to looking the order up by its
  // Razorpay order id (covers any payment created without notes).
  let orderId = ourOrderId;
  if (!orderId) {
    const { data } = await db.from("orders").select("id").eq("razorpay_order_id", razorpayOrderId).maybeSingle();
    orderId = data?.id ?? "";
  }
  if (!orderId) {
    // Payment we have no order for. Don't retry forever — log loudly instead.
    console.error(`[razorpay-webhook] paid but NO ORDER: rp_order=${razorpayOrderId} rp_payment=${razorpayPaymentId}`);
    return NextResponse.json({ ok: true, warning: "no matching order" }, { status: 200 });
  }

  const res = await markOrderPaid(db, orderId, razorpayOrderId, razorpayPaymentId);
  if (!res.ok) {
    console.error(`[razorpay-webhook] markOrderPaid failed for ${orderId}: ${res.error}`);
    return NextResponse.json({ error: res.error }, { status: 500 }); // let Razorpay retry
  }

  console.log(`[razorpay-webhook] ${orderId} ${res.newlyPaid ? "MARKED PAID (recovered)" : "already paid (no-op)"}`);
  return NextResponse.json({ ok: true, orderId, newlyPaid: res.newlyPaid }, { status: 200 });
}
