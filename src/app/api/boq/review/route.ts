import { NextResponse } from "next/server";
import { getProfile, isBusiness } from "@/lib/profile";
import { adminClient } from "@/lib/supabase/admin";

/** Smart BOM in-app feedback (owner ask): a 1-5 rating + comment collected
 *  right after a BOQ lands in the cart. Stored as partner_leads kind
 *  'boq_feedback' so it surfaces in the admin Requests tab. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isBusiness(profile)) return NextResponse.json({ ok: false }, { status: 403 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false }, { status: 503 });

  let body: { rating?: number; comment?: string; uploadId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const rating = Math.min(5, Math.max(1, Math.round(Number(body.rating) || 0)));
  if (!rating) return NextResponse.json({ ok: false }, { status: 400 });

  await db.from("partner_leads").insert({
    kind: "boq_feedback",
    email: profile.email || "unknown@boq.local",
    company: profile.company ?? null,
    message: (body.comment ?? "").slice(0, 2000) || `${rating}/5, no comment`,
    details: { rating, uploadId: body.uploadId ?? null },
  });
  return NextResponse.json({ ok: true });
}
