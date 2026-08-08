import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { fetchProductsLite } from "@/lib/products";
import { getSlugs } from "@/lib/blog";
import { listPublicCompareSlugs } from "@/lib/compare/pages";
import { submitIndexNow } from "@/lib/indexnow";

/**
 * One-shot full-site IndexNow submission (admin): every product page, blog
 * guide, compare page and core route. Use once after connecting Bing
 * Webmaster Tools, and again after large imports. Day-to-day changes ping
 * automatically from the admin write paths.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 403 });
  const [products, compareSlugs] = await Promise.all([fetchProductsLite(), listPublicCompareSlugs()]);
  const urls = [
    "/", "/catalogue", "/wholesale", "/metals", "/blog", "/compare",
    ...products.map((p) => `/catalogue/${p.id}`),
    ...getSlugs().map((s) => `/blog/${s}`),
    ...compareSlugs.map((s) => `/compare/${s.slug}`),
  ];
  await submitIndexNow(urls);
  return NextResponse.json({ ok: true, submitted: urls.length });
}
