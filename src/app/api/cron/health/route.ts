import { NextResponse } from "next/server";
import { runHealthCheck, recordHealth, alertOnHealth } from "@/lib/health";

/** Hourly (vercel.json): time the database and the three key pages, email
 *  the owner on trouble and on recovery, then store the result. Alert
 *  before storage on purpose: the mail must not wait behind a database
 *  write when the database is the thing that is broken. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const row = await runHealthCheck();
  const alert = await alertOnHealth(row);
  await recordHealth(row);
  return NextResponse.json({ ok: true, status: row.status, note: row.note, alert, row });
}
