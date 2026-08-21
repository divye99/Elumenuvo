import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { PRODUCTS_CACHE_TAG, forgetCatalogueMemo } from "@/lib/products";

/**
 * POST /api/admin/revalidate: drop the shared catalogue cache now.
 *
 * Every admin write path already revalidates on its own; this endpoint is
 * for changes that bypass the app, i.e. backfill scripts and raw SQL run in
 * the Supabase editor. The catalogue cache window is six hours (see
 * src/lib/products.ts), so without this call such a change could take up to
 * six hours to reach the storefront. Accepts the admin cookie (browser) or
 * the cron bearer secret (scripts: `curl -X POST -H "Authorization: Bearer
 * $CRON_SECRET" https://elumenuvo.com/api/admin/revalidate`).
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bySecret = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  if (!bySecret && !(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  revalidateTag(PRODUCTS_CACHE_TAG, "max");
  forgetCatalogueMemo();
  return NextResponse.json({ ok: true, tag: PRODUCTS_CACHE_TAG, at: new Date().toISOString() });
}
