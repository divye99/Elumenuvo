import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";
import { adminClient } from "@/lib/supabase/admin";

/**
 * "Can the signed-in visitor review this product without typing anything?"
 *
 * Returns eligible=true with their order id when the session email has a
 * real (paid, not cancelled) order containing the product. The PDP review
 * form then hides the order-ID and email fields entirely. Submission still
 * re-verifies server-side, so this endpoint is purely a UX hint.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const productId = new URL(request.url).searchParams.get("product") ?? "";
    if (!productId) return NextResponse.json({ eligible: false });
    const profile = await getProfile();
    const db = adminClient();
    if (!profile?.email || !db) return NextResponse.json({ eligible: false });
    const { data } = await db
      .from("orders")
      .select("id, name")
      .ilike("email", profile.email)
      .contains("product_ids", [productId])
      .not("status", "in", "(cancelled,payment_abandoned,awaiting_payment)")
      .order("created_at", { ascending: false })
      .limit(1);
    if (!data?.[0]) return NextResponse.json({ eligible: false });
    return NextResponse.json({ eligible: true, orderId: data[0].id, name: profile.full_name || data[0].name || "" });
  } catch {
    return NextResponse.json({ eligible: false });
  }
}
