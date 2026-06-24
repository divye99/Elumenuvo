import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/space/supabase/middleware";

// Next 16 "proxy" convention (formerly middleware). Refreshes the Supabase auth
// session for the Elume buyer app (/app) and the Elumenuvo (space) portal.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/space/portal", "/space/portal/:path*"],
};
