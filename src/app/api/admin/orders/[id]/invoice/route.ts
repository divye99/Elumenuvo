import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin/auth";
import { buildInvoiceModel, renderInvoicePdf, fyLabel, type InvoiceOrder } from "@/lib/invoice";

/**
 * One-click invoice PDF for an order.
 *   GET /api/admin/orders/<id>/invoice?type=tax        -> TAX INVOICE
 *   GET /api/admin/orders/<id>/invoice?type=proforma   -> PROFORMA INVOICE
 *
 * Admin-cookie gated. The tax invoice assigns a sequential FY-wise number on
 * first generation (assign_invoice_no, migration 0111) and reuses it on every
 * regeneration; pre-migration databases fall back to INV-<order-id> so the
 * button still works. Missing per-item HSN/GST data is backfilled from the
 * products table at render time (older orders stored bare item snapshots).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function service() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Admin sign-in required." }, { status: 401 });
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("type") === "proforma" ? "proforma" : "tax";

  const db = service();
  if (!db) return NextResponse.json({ error: "Service key not configured." }, { status: 503 });

  const { data: order, error } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const o = order as InvoiceOrder & { invoice_no?: string | null; invoice_date?: string | null; status?: string | null };

  // Backfill HSN + GST rate from the live catalogue where the item snapshot
  // lacks them - old orders predate hsn/gstRate in the cart item shape.
  const missing = (o.items ?? []).filter((i) => !i.hsn || i.gstRate == null).map((i) => i.id);
  if (missing.length) {
    const { data: prods } = await db.from("products").select("id, hsn, gst_rate, category").in("id", missing);
    const byId = new Map((prods ?? []).map((p) => [p.id as string, p]));
    for (const item of o.items ?? []) {
      const p = byId.get(item.id);
      if (!p) continue;
      if (!item.hsn && p.hsn) item.hsn = String(p.hsn);
      if (item.gstRate == null && p.gst_rate != null) item.gstRate = Number(p.gst_rate);
      if (!item.cat && p.category) item.cat = String(p.category);
    }
  }

  let number: string;
  let date = new Date();
  if (kind === "proforma") {
    number = `PI/${o.id}`;
  } else if (o.invoice_no) {
    number = o.invoice_no;
    if (o.invoice_date) date = new Date(o.invoice_date);
  } else {
    // First tax invoice for this order: mint the FY-sequential serial.
    const { data: assigned, error: rpcErr } = await db.rpc("assign_invoice_no", { p_order_id: o.id, p_fy: fyLabel(date) });
    if (!rpcErr && assigned) {
      number = String(assigned);
      try { await db.from("order_events").insert({ order_id: o.id, status: o.status ?? "placed", note: `Tax invoice ${number} generated` }); } catch { /* table optional */ }
    } else {
      // Migration 0111 not run yet - unique (order-derived), just not serial.
      number = `INV-${o.id}`;
    }
  }

  const model = buildInvoiceModel(o, kind, number, date);
  const pdf = await renderInvoicePdf(model);
  const fileName = `Elume-${kind === "tax" ? "Tax-Invoice" : "Proforma"}-${number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
