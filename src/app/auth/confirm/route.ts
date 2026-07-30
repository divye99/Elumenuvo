import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Token-hash sign-in endpoint: /auth/confirm?token_hash=...&type=magiclink&next=/app
 *
 * Verifies a Supabase OTP token ON OUR DOMAIN and writes the session cookies
 * here, instead of bouncing through Supabase's hosted /verify redirect. That
 * hosted hop is why the impersonation button "showed the homepage": a
 * redirect_to that is not on the project's allow-list silently falls back to
 * the Site URL, and the tokens die in a URL fragment nothing consumes.
 * Verifying server-side has no allow-list involved and works for any OTP
 * flow (impersonation links today, customer magic links tomorrow).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") ?? "magiclink";
  const next = url.searchParams.get("next") ?? "/app";
  // Only ever redirect within our own site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/app";

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/signin?error=missing-token", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as "magiclink" | "email" | "recovery" | "invite" | "signup",
    token_hash: tokenHash,
  });

  if (error) {
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(safeNext, url.origin));
}
