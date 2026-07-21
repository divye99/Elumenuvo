import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { setElumePrice, applyRecommendedPrice, applyRecommendedPrices } from "@/lib/admin/actions";

/** Price Radar mutations over a fixed URL (server-action ids rotate per
 *  deploy; see /api/admin/orders/action for the full story). Covers the
 *  pricing ops an operator uses constantly; mapping ops stay as actions. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  let res: { ok: boolean; error?: string };
  switch (String(body?.op ?? "")) {
    case "set-price": {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Invalid price." }, { status: 400 });
      res = await setElumePrice(String(body.productId), price);
      break;
    }
    case "apply":
      res = await applyRecommendedPrice(String(body.productId), Number(body.target));
      break;
    case "apply-all":
      res = await applyRecommendedPrices(Array.isArray(body.items) ? body.items.map((i: any) => ({ id: String(i.id), target: Number(i.target) })) : []);
      break;
    default:
      return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
  }
  return NextResponse.json(res, { status: res.ok ? 200 : 400 });
}
