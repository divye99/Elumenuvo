import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";

// Next 16 "proxy" convention (formerly middleware). Refreshes the Supabase auth
// session for the Elumenuvo (space) portal only.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/space/portal", "/space/portal/:path*"],
};
