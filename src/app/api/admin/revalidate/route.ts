import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createHmac, timingSafeEqual } from "node:crypto";
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
 * the cron bearer secret, or a short-lived token derived from the Supabase
 * service-role key (scripts/revalidate-catalogue.mjs mints it: header
 * x-revalidate-token: <expMs>.<base64url HMAC-SHA256(serviceKey, "revalidate.<expMs>")>),
 * so backfill scripts that already hold the service key can call it without
 * any Vercel-side secret. The raw key itself is never sent.
 */
export const dynamic = "force-dynamic";

function scriptTokenOk(value: string | null): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value || !key) return false;
  const [expStr, sig] = value.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + 3_600_000) return false;
  const expected = createHmac("sha256", key).update(`revalidate.${expStr}`).digest("base64url");
  const a = Buffer.from(sig ?? ""), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const bySecret = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
  const byScript = scriptTokenOk(request.headers.get("x-revalidate-token"));
  if (!bySecret && !byScript && !(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  revalidateTag(PRODUCTS_CACHE_TAG, "max");
  forgetCatalogueMemo();
  return NextResponse.json({ ok: true, tag: PRODUCTS_CACHE_TAG, at: new Date().toISOString() });
}
