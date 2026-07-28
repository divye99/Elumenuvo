import { NextResponse } from "next/server";
import { getProfile, isBusiness } from "@/lib/profile";

/**
 * Tiny session probe: "is this visitor a business account?".
 *
 * Exists so the product page can be CACHED (ISR). Reading the session on the
 * server made every product page dynamic, which meant Googlebot paid a full
 * database round-trip for each of 3,400+ URLs and crawled a fraction of them.
 * The page is now identical for everyone and this one call personalises it
 * after hydration.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getProfile();
    if (!profile) return NextResponse.json({ user: null, business: false });
    return NextResponse.json({
      user: { name: profile.full_name, email: profile.email, business: isBusiness(profile), company: profile.company },
      business: isBusiness(profile),
    });
  } catch {
    return NextResponse.json({ user: null, business: false });
  }
}
