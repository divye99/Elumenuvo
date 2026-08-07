import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { rebuildCompareKeys } from "@/lib/compare/build";

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
  return NextResponse.json({ ok: true, ...result });
}
