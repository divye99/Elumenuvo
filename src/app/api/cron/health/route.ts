import { NextResponse } from "next/server";
import { runHealthCheck, recordHealth, alertOnHealth } from "@/lib/health";

/** Every five minutes (vercel.json): time the database and the three key
 *  pages, store the result, email the owner on trouble and on recovery. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const row = await runHealthCheck();
  await recordHealth(row);
  const alert = await alertOnHealth(row);
  return NextResponse.json({ ok: true, status: row.status, note: row.note, alert, row });
}
