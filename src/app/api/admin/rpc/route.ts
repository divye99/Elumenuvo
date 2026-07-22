import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import {
  updateProductDetails,
  searchCompetitorAction,
  saveCompetitorMap,
  removeCompetitorMap,
  updateMapCondition,
  setMapApproval,
  acceptSuggestion,
  syncCompetitorNow,
  syncAllCompetitors,
  saveRepricingRule,
  deleteRepricingRule,
  previewImport,
  applyImport,
} from "@/lib/admin/actions";
import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Generic admin RPC over a FIXED URL — the remaining admin mutations
 * (products, competitor mapping, syncs, repricing rules, CSV import) were
 * still server actions, whose ids rotate every deployment and throw from any
 * tab opened before a push. Same pattern as /api/admin/orders/action.
 * Every underlying function ALSO verifies isAdmin itself (defense in depth).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300; // sync-all walks several competitor sites

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  let b: any;
  try { b = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  try {
    let res: unknown;
    switch (String(b?.op ?? "")) {
      case "update-product":       res = await updateProductDetails(b.input); break;
      case "delete-product": {
        // The old action was a redirecting form handler; JSON version here.
        const db = adminClient();
        if (!db) { res = { ok: false, error: "Service-role key missing." }; break; }
        const { error } = await db.from("products").delete().eq("id", String(b.id));
        if (!error) { revalidatePath("/admin/products"); revalidatePath("/catalogue"); }
        res = error ? { ok: false, error: error.message } : { ok: true };
        break;
      }
      case "search-competitor":    res = await searchCompetitorAction(String(b.source), String(b.query)); break;
      case "save-map":             res = await saveCompetitorMap(b.input); break;
      case "remove-map":           res = await removeCompetitorMap(String(b.productId), String(b.source)); break;
      case "map-condition":        res = await updateMapCondition(String(b.productId), String(b.source), String(b.condition)); break;
      case "map-approval":         res = await setMapApproval(String(b.productId), String(b.source), !!b.approve); break;
      case "accept-suggestion":    res = await acceptSuggestion(String(b.productId), String(b.source)); break;
      case "sync-source":          res = await syncCompetitorNow(String(b.source)); break;
      case "sync-all":             res = await syncAllCompetitors(); break;
      case "save-rule":            res = await saveRepricingRule(b.input); break;
      case "delete-rule":          res = await deleteRepricingRule(String(b.scope)); break;
      case "preview-import":       res = await previewImport(String(b.csvText ?? "")); break;
      case "apply-import":         res = await applyImport(Array.isArray(b.diffs) ? b.diffs : [], String(b.filename ?? "import.csv")); break;
      default: return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
    }
    return NextResponse.json(res as object, { status: 200 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Operation failed." }, { status: 500 });
  }
}
