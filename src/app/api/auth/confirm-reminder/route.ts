import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendConfirmReminder } from "@/lib/email";

/**
 * Called fire-and-forget right after a signup that requires email
 * confirmation. Schedules (via Resend scheduled_at) a reminder ~35 minutes
 * later for accounts still likely unconfirmed.
 *
 * Guarded against abuse: the caller must present the user id that signUp
 * returned, and the account must actually exist, match the email, be
 * unconfirmed, and be freshly created — otherwise nothing is sent.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { userId?: string; email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const userId = String(body.userId ?? "");
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!userId || !email) return NextResponse.json({ ok: false }, { status: 400 });

  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 200 }); // no key locally; never block signup

  const { data, error } = await db.auth.admin.getUserById(userId);
  const u = data?.user;
  if (error || !u) return NextResponse.json({ ok: false }, { status: 200 });
  const fresh = Date.now() - new Date(u.created_at).getTime() < 15 * 60_000;
  if (u.email?.toLowerCase() !== email || u.email_confirmed_at || !fresh) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  await sendConfirmReminder(email, (u.user_metadata as any)?.full_name ?? null);
  return NextResponse.json({ ok: true });
}
