import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendReviewReminder } from "@/lib/email";

/**
 * Daily review nudge: orders delivered 1+ day ago whose customer has not
 * reviewed anything from that order yet get ONE reminder email.
 *
 * - The delivered status email (sent at mark-delivered) already asks for a
 *   review; this is the single follow-up the day after.
 * - `review_reminder_sent_at` is stamped whether we send or skip (because a
 *   review exists), so no order is ever considered twice.
 * - Window capped at 14 days back so enabling the cron never mass-mails the
 *   whole delivered history.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Scheduled DAILY in vercel.json (Hobby plan allows at most daily).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BATCH = 40;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "service role missing" }, { status: 500 });

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600_000).toISOString();
  const twoWeeksAgo = new Date(now - 14 * 86_400_000).toISOString();

  const { data: orders, error } = await db
    .from("orders")
    .select("id, email, name, items, status, delivered_at, shipping_fee, subtotal, total")
    .eq("status", "delivered")
    .is("review_reminder_sent_at", null)
    .not("email", "is", null)
    .lte("delivered_at", dayAgo)
    .gte("delivered_at", twoWeeksAgo)
    .order("delivered_at", { ascending: true })
    .limit(BATCH);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  for (const order of orders ?? []) {
    // Already reviewed something from this order? Then no reminder, ever.
    const { count } = await db
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("order_id", order.id);
    if ((count ?? 0) === 0) {
      try {
        await sendReviewReminder(order as Parameters<typeof sendReviewReminder>[0]);
        sent += 1;
      } catch (e) {
        console.warn("[review-reminder]", order.id, e instanceof Error ? e.message : e);
        continue; // leave unstamped so tomorrow's run retries this one
      }
    } else {
      skipped += 1;
    }
    await db.from("orders").update({ review_reminder_sent_at: new Date().toISOString() }).eq("id", order.id);
  }

  return NextResponse.json({ ok: true, considered: orders?.length ?? 0, sent, skipped });
}
