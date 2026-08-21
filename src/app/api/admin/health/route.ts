import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { runHealthCheck, recordHealth } from "@/lib/health";

/** "Check now" on /admin/health: one on-demand run, stored, no email. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const row = await runHealthCheck();
  await recordHealth(row);
  return NextResponse.json({ ok: true, row });
}
