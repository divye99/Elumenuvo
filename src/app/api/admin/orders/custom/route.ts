import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fetchProduct } from "@/lib/products";
import { gstRateFor } from "@/lib/pricing";
import { newToken, customOrderUrl, customOrderTotals, type CustomOrderItem } from "@/lib/custom-orders";
import { sendCustomOrderLink } from "@/lib/email";

/**
 * Custom-order LINKS (owner ask, Aug 2026): the admin prepares items at an
 * admin-set price; the customer completes details + payment at /order/<token>
 * through the normal checkout. POST creates a link, GET lists recent ones.
 * Item building mirrors /api/admin/orders/create (ex-GST in, inclusive stored).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineIn = { kind: "catalogue" | "custom"; id?: string; name: string; qty: number; unit?: string; priceEx?: number; gstRate?: number; hsn?: string; cat?: string; note?: string };
type Body = {
  customer?: { name?: string; email?: string; phone?: string; gstin?: string; billingAddress?: string; shippingAddress?: string };
  items: LineIn[];
  shippingFee?: number | null;   // null/undefined = standard tiered delivery
  discountAmount?: number;
  note?: string;                 // customer-facing
  adminNote?: string;
  source?: string;
  expiresDays?: number;
  emailLink?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export async function buildItems(lines: LineIn[]): Promise<{ ok: true; items: CustomOrderItem[] } | { ok: false; error: string }> {
  const items: CustomOrderItem[] = [];
  for (const l of lines) {
    const qty = Math.max(1, Math.round(Number(l.qty)));
    if (l.kind === "catalogue" && l.id) {
      const p = await fetchProduct(l.id);
      if (!p) return { ok: false, error: `Catalogue product not found: ${l.id}` };
      const rate = l.gstRate ?? gstRateFor(p.cat, p.gstRate);
      const priceIncl = l.priceEx != null && l.priceEx > 0 ? r2(l.priceEx * (1 + rate)) : r2(p.price);
      items.push({ id: p.id, name: p.name, qty, price: priceIncl, cat: p.cat, gstRate: rate, ...(l.hsn?.trim() || p.hsn ? { hsn: l.hsn?.trim() || p.hsn } : {}), ...(p.shipWeightKg ? { shipWeightKg: p.shipWeightKg } : {}), unit: l.unit || p.unit, priceEx: r2(priceIncl / (1 + rate)), ...(r2(priceIncl) !== r2(p.price) ? { listPrice: p.price } : {}), ...(l.note ? { note: l.note.slice(0, 200) } : {}) });
    } else {
      const rate = Number.isFinite(l.gstRate) ? Number(l.gstRate) : 0.18;
      const priceEx = Number(l.priceEx);
      if (!Number.isFinite(priceEx) || priceEx <= 0) return { ok: false, error: `Enter an ex-GST unit price for "${l.name}".` };
      const priceIncl = r2(priceEx * (1 + rate));
      items.push({ id: `custom-${slug(l.name)}-${Math.random().toString(36).slice(2, 6)}`, name: l.name.trim().slice(0, 200), qty, price: priceIncl, cat: l.cat?.trim() || "Custom", gstRate: rate, ...(l.hsn?.trim() ? { hsn: l.hsn.trim() } : {}), unit: l.unit || "pc", priceEx: r2(priceEx), custom: true, ...(l.note ? { note: l.note.slice(0, 200) } : {}) });
    }
  }
  return { ok: true, items };
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Service role not configured." }, { status: 503 });
  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const lines = (body.items ?? []).filter((l) => l && l.name?.trim() && Number(l.qty) > 0);
  if (!lines.length) return NextResponse.json({ ok: false, error: "Add at least one line item." }, { status: 422 });
  const built = await buildItems(lines);
  if (!built.ok) return NextResponse.json({ ok: false, error: built.error }, { status: 422 });

  const c = body.customer ?? {};
  const token = newToken();
  const days = Math.min(90, Math.max(1, Math.round(Number(body.expiresDays) || 14)));
  const expires = new Date(Date.now() + days * 86400_000);
  const row = {
    token,
    expires_at: expires.toISOString(),
    status: "open",
    customer: { name: c.name?.trim() || undefined, email: c.email?.trim().toLowerCase() || undefined, phone: c.phone?.trim() || undefined, gstin: c.gstin?.trim() || undefined, billing: c.billingAddress?.trim() || undefined, shipping: c.shippingAddress?.trim() || undefined },
    items: built.items,
    shipping_fee: body.shippingFee == null || body.shippingFee === ("" as unknown) ? null : Math.max(0, r2(Number(body.shippingFee) || 0)),
    discount_amount: Math.max(0, r2(Number(body.discountAmount) || 0)),
    note: body.note?.trim() || null,
    admin_note: body.adminNote?.trim() || null,
    source: (body.source || "phone").slice(0, 40),
    created_by: "admin",
  };
  const { error } = await db.from("custom_orders").insert(row);
  if (error) {
    const msg = String(error.message || "");
    const missingTable = /custom_orders/.test(msg) || /PGRST205/.test(String((error as { code?: string }).code || "")) || /<!DOCTYPE|<html/i.test(msg);
    return NextResponse.json({ ok: false, error: missingTable ? "The custom_orders table is not there yet: run migration 0131 in Supabase, then try again." : msg.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200) }, { status: 500 });
  }

  const url = customOrderUrl(token);
  const { goodsPayable } = customOrderTotals({ items: built.items, discount_amount: row.discount_amount });
  let emailed = false;
  if (body.emailLink && row.customer.email) {
    const r = await sendCustomOrderLink({ email: row.customer.email, name: row.customer.name ?? null }, { url, total: goodsPayable + (row.shipping_fee ?? 0), note: row.note, expiresLabel: expires.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) });
    emailed = !!r.ok;
  }
  return NextResponse.json({ ok: true, token, url, expiresAt: expires.toISOString(), emailed, goodsPayable });
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: true, links: [] });
  const { data } = await db.from("custom_orders").select("token,created_at,expires_at,status,customer,items,shipping_fee,discount_amount,source,converted_order_id").order("created_at", { ascending: false }).limit(40);
  const links = (data ?? []).map((r) => {
    const t = customOrderTotals({ items: r.items, discount_amount: r.discount_amount });
    return { token: r.token, url: customOrderUrl(r.token), created_at: r.created_at, expires_at: r.expires_at, status: r.status, customer: r.customer, lines: (r.items ?? []).length, total: r2(t.goodsPayable + (Number(r.shipping_fee) || 0)), source: r.source, converted_order_id: r.converted_order_id };
  });
  return NextResponse.json({ ok: true, links });
}
