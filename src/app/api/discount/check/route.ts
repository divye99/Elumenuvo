import { NextResponse } from "next/server";
import { checkDiscountCode } from "@/lib/order-actions";

/** Checkout asks whether a code is valid for this email. Read-only preview:
 *  the authoritative application happens again inside startOnlinePayment. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { code?: string; email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const res = await checkDiscountCode(String(body.code ?? ""), String(body.email ?? ""));
  return NextResponse.json(res, { status: 200 });
}
