import { NextResponse } from "next/server";
import { createClient } from "@/lib/space/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/space/portal", request.url), {
    status: 303,
  });
}
