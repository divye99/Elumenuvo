/**
 * Vercel Cron endpoint — reaps expired sandbox orgs hourly.
 * Configured in vercel.json. Protected by CRON_SECRET (Vercel sends it as a
 * Bearer token automatically).
 */
import { NextResponse } from "next/server";
import { reapExpiredSandboxes } from "@/lib/services/sandboxProvisioning";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const removed = await reapExpiredSandboxes();
  return NextResponse.json({ ok: true, removed });
}
