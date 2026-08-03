import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { gstRateFor } from "@/lib/pricing";
import { isMetalCategory, unitPriceFromRate } from "@/lib/metals";

/**
 * Metals console mutations over a fixed URL (server-action ids rotate per
 * deploy; same pattern as /api/admin/radar/action). Ops:
 *
 *   set-rates     - { entries: [{ id, rate }] } where rate is the EX-GST ₹/kg
 *                   the admin quotes (trade convention). The stored
 *                   elume_price stays GST-INCLUSIVE PER SELLING UNIT
 *                   (per kg for Super D, per lot for rods), so the whole
 *                   cart/checkout/invoice pipeline works unchanged.
 *   toggle-active - { id, active } - publish/unpublish one metals product.
 *
 * Only products in METALS_CATEGORIES can be touched here; every price write
 * is snapshotted into price_history so the selling-price chart grows.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function revalidateMetals(ids: string[]) {
  revalidatePath("/admin/metals");
  revalidatePath("/catalogue");
  for (const id of new Set(ids)) revalidatePath(`/catalogue/${id}`);
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY missing - writes disabled." }, { status: 500 });
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  switch (String(body?.op ?? "")) {
    case "set-rates": {
      const entries: { id: string; rate: number }[] = Array.isArray(body.entries)
        ? body.entries.map((e: any) => ({ id: String(e.id), rate: Number(e.rate) }))
        : [];
      const force = Boolean(body.force);
      if (!entries.length) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
      if (entries.some((e) => !Number.isFinite(e.rate) || e.rate <= 0 || e.rate > 100_000)) {
        return NextResponse.json({ ok: false, error: "Rates must be positive ₹/kg numbers." }, { status: 400 });
      }

      const ids = entries.map((e) => e.id);
      const { data: rows, error } = await db
        .from("products")
        .select("id, name, category, gst_rate, attrs, elume_price")
        .in("id", ids);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      const byId = new Map((rows ?? []).map((r: any) => [r.id, r]));

      // Validate everything BEFORE writing anything, so a bad entry can't
      // leave the batch half-applied.
      const writes: { id: string; gross: number; movePct: number | null }[] = [];
      for (const e of entries) {
        const row = byId.get(e.id);
        if (!row) return NextResponse.json({ ok: false, error: `Unknown product ${e.id}.` }, { status: 400 });
        if (!isMetalCategory(row.category)) {
          return NextResponse.json({ ok: false, error: `${e.id} is not a metals product.` }, { status: 400 });
        }
        const gross = unitPriceFromRate(e.rate, gstRateFor(row.category, row.gst_rate != null ? Number(row.gst_rate) : null), row.attrs);
        const current = Number(row.elume_price);
        const movePct = current > 0 ? Math.abs(gross / current - 1) * 100 : null;
        writes.push({ id: e.id, gross, movePct });
      }

      // Fat-finger guard: copper moves a percent or two between updates; a
      // >15% jump is almost always a typo (₹84 for ₹840). The console re-sends
      // with force:true after the operator confirms.
      if (!force) {
        const big = writes.filter((w) => w.movePct != null && w.movePct > 15);
        if (big.length) {
          const detail = big
            .map((w) => `${(byId.get(w.id) as any)?.name ?? w.id} moves ${w.movePct!.toFixed(1)}%`)
            .join("; ");
          return NextResponse.json({ ok: false, needsConfirm: true, error: `Big move - please confirm: ${detail}.` }, { status: 409 });
        }
      }

      const updated: { id: string; elume_price: number }[] = [];
      let failed: string | null = null;
      for (const w of writes) {
        const { error: upErr } = await db.from("products").update({ elume_price: w.gross, mrp: w.gross }).eq("id", w.id);
        if (upErr) { failed = upErr.message; break; }
        // Best-effort history snapshot - feeds the selling-price chart.
        try { await db.from("price_history").insert({ product_id: w.id, elume_price: w.gross, mrp: w.gross }); } catch { /* table may not exist yet */ }
        updated.push({ id: w.id, elume_price: w.gross });
      }
      // Revalidate whatever DID write, even on failure - a stale ISR page
      // selling at yesterday's rate is worse than a partial batch.
      if (updated.length) revalidateMetals(updated.map((u) => u.id));
      if (failed) {
        return NextResponse.json(
          { ok: false, error: `Saved ${updated.length} of ${writes.length}, then: ${failed}. Re-save the remaining rows.`, updated },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, updated });
    }

    case "toggle-active": {
      const id = String(body.id ?? "");
      const active = Boolean(body.active);
      const { data: row } = await db.from("products").select("id, category").eq("id", id).maybeSingle();
      if (!row) return NextResponse.json({ ok: false, error: `Unknown product ${id}.` }, { status: 400 });
      if (!isMetalCategory(row.category)) return NextResponse.json({ ok: false, error: `${id} is not a metals product.` }, { status: 400 });
      const { error } = await db.from("products").update({ is_active: active }).eq("id", id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      revalidateMetals([id]);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ ok: false, error: "Unknown operation." }, { status: 400 });
  }
}
