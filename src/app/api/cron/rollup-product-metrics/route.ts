import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Nightly product-metrics rollup (see migration 0061): re-computes the last
 * few IST days of product_metrics_daily (glance views, cart adds, units,
 * orders, revenue) from site_events + orders. The window overlaps on purpose:
 * late UPI captures and same-day edits get folded in on the next run, and the
 * SQL function upserts per (day, product), so re-runs are harmless.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Service-role key missing." }, { status: 500 });

  // Today and the three days before it, as IST calendar dates.
  const istNow = new Date(Date.now() + 5.5 * 3_600_000);
  const to = istNow.toISOString().slice(0, 10);
  const from = new Date(istNow.getTime() - 3 * 86_400_000).toISOString().slice(0, 10);

  const { data, error } = await db.rpc("rollup_product_metrics", { from_day: from, to_day: to });
  if (error) {
    return NextResponse.json({ error: `${error.message} (run migration 0061?)` }, { status: 500 });
  }
  return NextResponse.json({ ok: true, from, to, rows: data });
}
