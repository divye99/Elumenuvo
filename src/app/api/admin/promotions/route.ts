import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/** Admin CRUD for Merchant Center promotions (migration 0129). The public
 *  feed at /api/merchant-promotions reflects changes on Google's next
 *  scheduled fetch; no revalidation needed (force-dynamic). */
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
      case "create": {
        const promotion_id = String(body.promotionId ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
        const long_title = String(body.longTitle ?? "").trim().slice(0, 60);
        const offer_type = body.offerType === "GENERIC_CODE" ? "GENERIC_CODE" : "NO_CODE";
        const redemption_code = String(body.redemptionCode ?? "").trim().toUpperCase().slice(0, 30) || null;
        const applicability = body.applicability === "SPECIFIC_PRODUCTS" ? "SPECIFIC_PRODUCTS" : "ALL_PRODUCTS";
        const item_ids = applicability === "SPECIFIC_PRODUCTS"
          ? String(body.itemIds ?? "").split(/[\s,]+/).map((s: string) => s.trim()).filter(Boolean).slice(0, 500)
          : null;
        const starts_at = new Date(String(body.startsAt));
        const ends_at = new Date(String(body.endsAt));
        if (!promotion_id || !long_title) return NextResponse.json({ ok: false, error: "Promotion id and title are required." }, { status: 400 });
        if (offer_type === "GENERIC_CODE" && !redemption_code) return NextResponse.json({ ok: false, error: "A shared code is required for a code promotion." }, { status: 400 });
        if (applicability === "SPECIFIC_PRODUCTS" && !item_ids?.length) return NextResponse.json({ ok: false, error: "List at least one product id." }, { status: 400 });
        if (!(starts_at < ends_at)) return NextResponse.json({ ok: false, error: "End must be after start." }, { status: 400 });
        if (ends_at.getTime() - starts_at.getTime() > 183 * 86400_000) return NextResponse.json({ ok: false, error: "Google caps a promotion at 6 months - shorten the window." }, { status: 400 });
        const { error } = await db.from("merchant_promotions").insert({
          promotion_id, long_title, offer_type, redemption_code, applicability, item_ids,
          min_purchase: Number(body.minPurchase) > 0 ? Number(body.minPurchase) : null,
          starts_at: starts_at.toISOString(), ends_at: ends_at.toISOString(),
        });
        if (error) return NextResponse.json({ ok: false, error: error.code === "23505" ? "That promotion id already exists." : error.code === "42P01" ? "Run migration 0129 first." : error.message }, { status: 400 });
        break;
      }
      case "toggle": {
        const { error } = await db.from("merchant_promotions").update({ active: Boolean(body.active) }).eq("id", String(body.id));
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        break;
      }
      case "delete": {
        const { error } = await db.from("merchant_promotions").delete().eq("id", String(body.id));
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        break;
      }
      default:
        return NextResponse.json({ ok: false, error: "Unknown op." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}
