import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/** Merit panel actions: config (Brand Promoter list, milestone), per-product
 *  overrides (boost / suppress / note) and exploration cooldowns (always a
 *  timestamp - temporary by construction). Every write drops the "merit"
 *  cache tag so the storefront picks it up on the next request. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 403 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Server storage unavailable." }, { status: 500 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  try {
    switch (String(body.op)) {
      case "config": {
        const promoterBrands = Array.isArray(body.promoterBrands)
          ? body.promoterBrands.map((b: unknown) => String(b).trim()).filter(Boolean).slice(0, 40)
          : [];
        const milestoneCr = Number(body.milestoneCr) > 0 ? Number(body.milestoneCr) : 10;
        const shareRaw = Number(body.promoterExploreShare);
        const promoterExploreShare = Number.isFinite(shareRaw) ? Math.min(1, Math.max(0, shareRaw)) : 0.7;
        await db.from("app_kv").upsert({ k: "merit_config", v: { promoterBrands, milestoneCr, promoterExploreShare }, updated_at: new Date().toISOString() });
        break;
      }
      case "override": {
        const product_id = String(body.productId ?? "");
        if (!product_id) return NextResponse.json({ ok: false, error: "Missing product." }, { status: 400 });
        await db.from("merit_overrides").upsert({
          product_id,
          boost: Number(body.boost) || 0,
          suppressed: Boolean(body.suppressed),
          note: body.note ? String(body.note).slice(0, 300) : null,
          updated_at: new Date().toISOString(),
        });
        break;
      }
      case "cooldown": {
        const product_id = String(body.productId ?? "");
        if (!product_id) return NextResponse.json({ ok: false, error: "Missing product." }, { status: 400 });
        // days > 0 sets a temporary cooldown; days = 0 clears it (and clears
        // the evidence trail so the automatic rule doesn't re-trip today).
        const days = Math.max(0, Math.min(90, Number(body.days) || 0));
        const until = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null;
        await db.from("merit_overrides").upsert({ product_id, cooldown_until: until, updated_at: new Date().toISOString() });
        if (!until) await db.from("explore_log").delete().eq("product_id", product_id);
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown op." }, { status: 400 });
    }
    revalidateTag("merit", "max");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
