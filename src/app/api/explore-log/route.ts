import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited, requestIp } from "@/lib/rate-limit";
import { isBotRequest } from "@/lib/bots";

/** Exploration-slot impression log (migration 0122): one row per time the
 *  diversity engine showed an under-exposed brand's product. This is the
 *  evidence trail behind cooldowns and the /admin/merit panel. Beacon-style:
 *  always 204, never blocks the storefront. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (rateLimited(`explore:${requestIp(request.headers)}`, 40, 60_000)) return new NextResponse(null, { status: 204 });
    if (isBotRequest(request.headers)) return new NextResponse(null, { status: 204 });
    const body = await request.json().catch(() => null);
    const pid = String(body?.pid ?? "").slice(0, 80);
    if (!pid) return new NextResponse(null, { status: 204 });
    const db = adminClient();
    if (!db) return new NextResponse(null, { status: 204 });
    await db.from("explore_log").insert({
      product_id: pid,
      brand: body?.brand ? String(body.brand).slice(0, 80) : null,
      query_norm: body?.q ? String(body.q).toLowerCase().slice(0, 160) : null,
    });
  } catch { /* logging must never break the page */ }
  return new NextResponse(null, { status: 204 });
}
