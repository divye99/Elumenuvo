import { NextResponse } from "next/server";
import { rebuildCompareKeys } from "@/lib/compare/build";

/**
 * Nightly compare-mapping rebuild: re-fingerprints the whole catalogue so
 * new products (and whole new brands) map into existing compare groups
 * automatically. Also runnable on demand from /admin/compare.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await rebuildCompareKeys();
  if ("error" in result) return NextResponse.json({ ok: false, ...result }, { status: 500 });
  return NextResponse.json({ ok: true, ...result });
}
