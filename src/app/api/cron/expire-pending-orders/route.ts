import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Sweeper: retire orders that were created for a payment that never completed.
 *
 * `startOnlinePayment` writes the order as `awaiting_payment` before opening the
 * payment window (so the webhook can recover a payment whose browser callback
 * never returned). Customers who abandon the window leave that row behind, so
 * this marks anything still unpaid after a grace period as `payment_abandoned`.
 *
 * The grace period is deliberately generous: a UPI collect request can sit
 * pending for several minutes, and Razorpay may retry its webhook. We must never
 * retire an order that is about to be marked paid.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Schedule it hourly in vercel.json.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRACE_MINUTES = 60;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Database unavailable." }, { status: 500 });

  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60_000).toISOString();

  // Only ever touch rows still awaiting payment — a paid order is never at risk.
  const { data, error } = await db
    .from("orders")
    .update({ status: "payment_abandoned" })
    .eq("status", "awaiting_payment")
    .lt("created_at", cutoff)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const expired = data?.length ?? 0;
  if (expired) console.log(`[expire-pending-orders] retired ${expired} unpaid order(s): ${data!.map((o) => o.id).join(", ")}`);
  return NextResponse.json({ ok: true, expired, cutoff }, { status: 200 });
}
