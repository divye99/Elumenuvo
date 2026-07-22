import { NextResponse } from "next/server";
import { checkDiscountCode } from "@/lib/order-actions";
import { rateLimited, requestIp } from "@/lib/rate-limit";

/** Checkout asks whether a code is valid for this email. Read-only preview:
 *  the authoritative application happens again inside startOnlinePayment. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (rateLimited(`disc:${requestIp(request.headers)}`, 12, 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts — wait a minute and try again." }, { status: 429 });
  }
  let body: { code?: string; email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const res = await checkDiscountCode(String(body.code ?? ""), String(body.email ?? ""));
  return NextResponse.json(res, { status: 200 });
}
