import { NextResponse } from "next/server";
import { syncOpenShipments } from "@/lib/shiprocket-sync";

/**
 * Scheduled tracking sync (vercel.json, every 3 hours): pulls the latest
 * courier scans for every open Shiprocket shipment, stamps pickup/delivery
 * milestones and rolls order statuses (out_for_delivery, delivered + customer
 * email). The webhook does this in real time; the cron is the safety net for
 * missed pushes.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const report = await syncOpenShipments();
  return NextResponse.json({ ok: true, synced: Object.keys(report).length, report });
}
