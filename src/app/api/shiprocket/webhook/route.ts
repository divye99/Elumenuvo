import { NextResponse } from "next/server";
import { syncAwb } from "@/lib/shiprocket-sync";

/**
 * Shiprocket status webhook - register in Shiprocket panel:
 *   Settings -> API -> Webhooks -> Add
 *   URL:   https://elumenuvo.com/api/shiprocket/webhook
 *   Token: the SHIPROCKET_WEBHOOK_TOKEN env value (sent as x-api-key)
 *
 * The payload is used ONLY to learn which AWB moved; the actual state is
 * re-fetched from the tracking API (see shiprocket-sync.ts), so a spoofed
 * call can at worst cause one extra read. Always answers 200 - Shiprocket
 * disables webhooks that keep failing, and the cron would then be the only
 * sync path.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = (process.env.SHIPROCKET_WEBHOOK_TOKEN || "").trim();
  if (expected) {
    const got = (request.headers.get("x-api-key") ?? request.headers.get("token") ?? "").trim();
    if (got !== expected) return NextResponse.json({ ok: true }); // swallow silently
  }
  let awb = "";
  try {
    const body = await request.json();
    awb = String(body?.awb ?? body?.awb_code ?? "").trim();
  } catch { /* non-JSON ping */ }
  if (awb) {
    try { await syncAwb(awb); } catch (e) { console.error("[shiprocket-webhook]", e); }
  }
  return NextResponse.json({ ok: true });
}
