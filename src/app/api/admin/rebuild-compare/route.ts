import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { rebuildCompareKeys } from "@/lib/compare/build";
import { PRODUCTS_CACHE_TAG, forgetCatalogueMemo } from "@/lib/products";

/**
 * Full compare-mapping rebuild, admin-triggered ("Rebuild mappings now").
 * Lives in a route (not a server action) for the long deadline: a full
 * catalogue rebuild writes a few thousand rows and a server action's
 * default deadline killed the first production run halfway through.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 403 });
  const result = await rebuildCompareKeys();
  if ("error" in result) return NextResponse.json({ ok: false, ...result }, { status: 500 });
  // PDP compare rails read compare keys through the products cache - without
  // this, rebuilt groups would wait out the (now day-long) ISR window.
  revalidateTag(PRODUCTS_CACHE_TAG, "max");
  forgetCatalogueMemo();
  return NextResponse.json({ ok: true, ...result });
}
