import { NextResponse } from "next/server";
import { getProfile } from "@/lib/profile";
import { buildRails } from "@/lib/personal/engine";
import { BOT_RE, bouncerVerdict, BOUNCER_SERVES } from "@/lib/bots";

/**
 * Personal rails for a surface: /api/personal/rails?ctx=home|foryou|pdp:<id>&sid=<device token>
 *
 * Pages stay cached and identical for everyone (ISR/static); this endpoint
 * personalises them AFTER hydration - the same pattern the business-GST
 * probe uses. Guests personalise via the sid device token; a signed-in
 * session adds the purchase layer (reorders, portfolio-weighted picks).
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Bots and frozen-UA scrapers get no personalisation: this endpoint is
    // uncached and reads site_events per call, so it must only serve humans.
    const ua = request.headers.get("user-agent") ?? "";
    if (BOT_RE.test(ua) || !BOUNCER_SERVES.has(bouncerVerdict(request.headers))) return NextResponse.json({ rails: [] });
    const url = new URL(request.url);
    const ctx = (url.searchParams.get("ctx") ?? "home").slice(0, 60);
    const sid = url.searchParams.get("sid")?.slice(0, 60) ?? null;
    let email: string | null = null;
    try {
      email = (await getProfile())?.email ?? null;
    } catch { /* guest */ }
    const rails = await buildRails({ ctx, sid, email });
    return NextResponse.json({ rails });
  } catch {
    return NextResponse.json({ rails: [] }); // personalisation must never break a page
  }
}
