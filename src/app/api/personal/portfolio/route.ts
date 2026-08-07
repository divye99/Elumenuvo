import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";
import { isAdmin } from "@/lib/admin/auth";
import { buildPortfolio } from "@/lib/personal/engine";

/**
 * Purchase portfolio + replenishment predictions for one customer.
 * - No param: the signed-in customer's own portfolio (dashboard).
 * - ?email=: admin only - account intelligence for any customer.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const asked = new URL(request.url).searchParams.get("email");
    let email: string | null = null;
    if (asked) {
      if (!(await isAdmin())) return NextResponse.json({ portfolio: null }, { status: 403 });
      email = asked;
    } else {
      email = (await getProfile())?.email ?? null;
    }
    if (!email) return NextResponse.json({ portfolio: null });
    return NextResponse.json({ portfolio: await buildPortfolio(email) });
  } catch {
    return NextResponse.json({ portfolio: null });
  }
}
