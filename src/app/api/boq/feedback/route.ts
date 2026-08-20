import { NextResponse } from "next/server";
import { getProfile, isBusiness } from "@/lib/profile";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { normalizeSearchText } from "@/lib/search-normalize";

/**
 * Smart BOM learning loop. Every review decision lands here:
 *  - confirmed / swapped: upsert product_aliases (normalized phrasing ->
 *    accepted product, hits+1) so the SAME wording matches instantly next
 *    time - this is the self-improving core, shared with search via the
 *    aliases table.
 *  - rejected: no alias write (a wrong guess must not be reinforced).
 *  - unmatched_confirmed: the user says we genuinely do not stock it ->
 *    partner_leads (kind 'boq_unmatched'), the owner's what-to-import-next
 *    demand feed in the admin Requests tab.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  uploadId?: string;
  lines?: Array<{
    position: number;
    description: string;
    action: "confirmed" | "swapped" | "rejected" | "unmatched_confirmed";
    productId?: string | null;   // the FINAL product (for swapped, the swap target)
    finalQty?: number | null;
  }>;
};

export async function POST(req: Request) {
  const admin = await isAdmin();
  const profile = admin ? null : await getProfile();
  if (!admin) {
    if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
    if (!isBusiness(profile)) return NextResponse.json({ ok: false }, { status: 403 });
  }
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const lines = (body.lines ?? []).slice(0, 250);
  if (!body.uploadId || !lines.length) return NextResponse.json({ ok: false }, { status: 400 });

  // The upload must belong to the caller (admin may touch any) - the
  // service role bypasses RLS, so this check is the ownership gate.
  const { data: upload } = await db.from("boq_uploads").select("id, user_id").eq("id", body.uploadId).maybeSingle();
  if (!upload || (!admin && upload.user_id !== profile!.id)) return NextResponse.json({ ok: false }, { status: 403 });

  let aliasWrites = 0, leads = 0;
  for (const l of lines) {
    const status = l.action === "unmatched_confirmed" ? "unmatched" : l.action;
    await db.from("boq_lines")
      .update({ status, final_product_id: l.productId ?? null, final_qty: l.finalQty ?? null })
      .eq("upload_id", body.uploadId).eq("position", l.position);

    if ((l.action === "confirmed" || l.action === "swapped") && l.productId && l.description) {
      const alias_norm = normalizeSearchText(l.description).slice(0, 300);
      if (alias_norm.length >= 4) {
        // Upsert-with-increment: PostgREST has no atomic increment on upsert,
        // so read-then-write; hits are advisory ranking, not accounting.
        const { data: existing } = await db.from("product_aliases")
          .select("id, hits").eq("alias_norm", alias_norm).eq("product_id", l.productId).maybeSingle();
        if (existing) {
          await db.from("product_aliases").update({ hits: (existing.hits ?? 1) + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
        } else {
          await db.from("product_aliases").insert({ alias_norm, product_id: l.productId, source: "boq" });
        }
        aliasWrites++;
      }
    }

    if (l.action === "unmatched_confirmed" && l.description) {
      await db.from("partner_leads").insert({
        kind: "boq_unmatched",
        // Admin-run BOQs are enquiries the owner is fulfilling: label them
        // so the Requests tab shows where the demand signal came from.
        email: profile?.email || "admin@elumenuvo.com",
        company: profile?.company ?? (admin ? "Elume admin console" : null),
        message: l.description.slice(0, 500),
        details: { uploadId: body.uploadId, position: l.position },
      });
      leads++;
    }
  }

  return NextResponse.json({ ok: true, aliasWrites, leads });
}
