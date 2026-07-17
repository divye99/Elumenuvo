import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Daily price snapshot (see migration 0048): logs every active product's own
 * price, and every approved competitor's current price, once per UTC day,
 * whether or not anything changed. Feeds the product page's price-history
 * chart (our line + avg market line).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Scheduled DAILY in vercel.json (Hobby plan allows daily at most, and an
 * invalid schedule fails the entire deployment). The SQL function is
 * idempotent per day, so a manual re-run is harmless.
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
  if (!db) return NextResponse.json({ error: "Database unavailable." }, { status: 500 });

  const { data, error } = await db.rpc("log_daily_prices");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = Array.isArray(data) ? data[0] : data;
  console.log(`[log-daily-prices] products=${row?.products_logged ?? "?"} competitor_rows=${row?.competitor_rows_logged ?? "?"}`);
  return NextResponse.json({ ok: true, ...row }, { status: 200 });
}
