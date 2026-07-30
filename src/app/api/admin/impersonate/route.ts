import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Support impersonation: mint a one-time sign-in link for a customer so an
 * admin can open THEIR workspace exactly as they see it, and act on it when
 * support requires (the link signs the browser in AS the customer).
 *
 * Guard rails:
 *   • admin session required - this route does nothing for anyone else;
 *   • the link is returned to the admin, never emailed to the customer, so
 *     the customer sees nothing;
 *   • single-use and short-lived (Supabase magic-link semantics);
 *   • every issue is recorded in order_events-style audit via console AND a
 *     site note, so "who looked at whose account" is answerable later.
 *
 * Practical use: open the link in a PRIVATE window, otherwise it replaces
 * your own storefront session in this browser; sign out when done.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://elumenuvo.com";

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Service-role key missing." }, { status: 500 });

  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email) return NextResponse.json({ ok: false, error: "Email required." }, { status: 400 });

  const { data, error } = await db.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${SITE}/app` },
  });
  if (error || !data?.properties?.action_link) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Could not create a link (does this user exist?)." }, { status: 400 });
  }

  console.log(`[impersonate] admin opened a sign-in link for ${email} at ${new Date().toISOString()}`);
  return NextResponse.json({ ok: true, link: data.properties.action_link });
}
