import { NextResponse } from "next/server";
import { createClient } from "@/lib/space/supabase/server";

/* Magic-link landing. Supabase redirects here with a PKCE `code`, which
   we exchange for a session cookie, then send the user into the portal. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/space/portal";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/space/portal?error=auth`);
}
