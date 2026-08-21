import { NextResponse } from "next/server";
import { mintPass, PASS_COOKIE, PASS_DAYS } from "@/lib/bouncer-pass";

/** Target of the "I am a person" button on the bouncer's refusal page. Sets
 *  the signed pass cookie and sends the visitor back to the page they asked
 *  for. Plain form POST, so it works without JavaScript. This path is outside
 *  the proxy matcher on purpose. */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let next = "/";
  try {
    const form = await request.formData();
    const raw = String(form.get("next") ?? "/");
    if (raw.startsWith("/") && !raw.startsWith("//") && !/[\r\n]/.test(raw)) next = raw;
  } catch { /* keep "/" */ }
  const value = await mintPass();
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  if (value) {
    res.cookies.set(PASS_COOKIE, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PASS_DAYS * 86_400 });
  }
  return res;
}
