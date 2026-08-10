import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { sendBoqInvite } from "@/lib/email";

/**
 * One-shot Smart BOM launch email (owner-triggered, Aug 2026).
 * Recipients = every business customer we have: registered business accounts
 * (profiles.account_type = 'business', email via auth) plus guest buyers who
 * ordered with a GSTIN. Deduplicated; each send is individual (no bulk BCC).
 * POST { dryRun?: boolean } - dryRun returns the list without sending.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 403 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });

  let dryRun = false;
  try { dryRun = Boolean((await req.json())?.dryRun); } catch { /* empty body = live send */ }

  // Registered business accounts (emails live in auth, not profiles).
  const recipients = new Map<string, string>(); // email -> company/label
  const { data: biz } = await db.from("profiles").select("id, company").eq("account_type", "business");
  const { data: users } = await db.auth.admin.listUsers({ perPage: 500 });
  const emailById = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  for (const b of biz ?? []) {
    const e = emailById.get(b.id);
    if (e) recipients.set(e.toLowerCase(), b.company ?? "");
  }
  // Guest GSTIN buyers - businesses in behaviour if not in account type.
  const { data: gstOrders } = await db.from("orders").select("email").neq("gstin", "").not("gstin", "is", null).limit(1000);
  for (const o of gstOrders ?? []) {
    if (o.email && !recipients.has(o.email.toLowerCase())) recipients.set(o.email.toLowerCase(), "");
  }

  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, recipients: [...recipients.keys()] });

  const results: Array<{ to: string; ok: boolean; error?: string; skipped?: boolean }> = [];
  for (const [email, company] of recipients) {
    const r = await sendBoqInvite(email, company || null);
    results.push({ to: email, ...r });
  }
  return NextResponse.json({ ok: true, sent: results.filter((r) => r.ok).length, results });
}
