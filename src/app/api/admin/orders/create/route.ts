import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fetchProduct } from "@/lib/products";
import { gstRateFor } from "@/lib/pricing";
import { normalisePhoneE164 } from "@/lib/phone";
import { sendAdminNewOrder, sendCustomerOrderConfirmation } from "@/lib/email";

/**
 * Custom orders from the admin (owner ask, Aug 2026): customers phone in for
 * specific or customised products that are not on the website, and those
 * orders must live in the same orders table as everything else so invoices,
 * status flow, Shiprocket and analytics all apply.
 *
 * Mirrors lib/order-actions insertPendingOrder field for field:
 *  - items[].price is GST-INCLUSIVE (the invoice derives taxable = incl / (1+rate))
 *  - subtotal = taxable value of the goods, total = goods + shipping - discount
 *  - custom lines carry `custom: true`, their own gstRate/hsn and a synthetic
 *    id (custom-<slug>) that no catalogue rollup will ever match (harmless)
 * Catalogue lines are hydrated from the live product (name, cat, GST, HSN)
 * but the admin's price wins, because that is the point of this tool.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LineIn = {
  kind: "catalogue" | "custom";
  id?: string;
  name: string;
  qty: number;
  unit?: string;
  priceEx?: number;     // admin enters EX-GST unit price
  gstRate?: number;     // 0.18
  hsn?: string;
  cat?: string;
  note?: string;
};
type Body = {
  customer: { name: string; email: string; phone: string; gstin?: string; billingAddress: string; shippingAddress: string; addressDetails?: unknown };
  items: LineIn[];
  shippingFee?: number;
  discountAmount?: number;
  paymentMethod: "online" | "cod" | "neft" | "upi" | "cash" | "credit";
  paid: boolean;
  status?: "confirmed" | "placed" | "packed";
  source?: string;      // phone / whatsapp / email / walk-in
  adminNote?: string;
  emailCustomer?: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
const orderId = () => {
  const d = new Date();
  return `ELM-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in to admin." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ ok: false, error: "Service role not configured." }, { status: 503 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }
  const c = body.customer ?? ({} as Body["customer"]);
  if (!c.name?.trim()) return NextResponse.json({ ok: false, error: "Customer name is required." }, { status: 422 });
  if (!/^\S+@\S+\.\S+$/.test(c.email ?? "")) return NextResponse.json({ ok: false, error: "A valid customer email is required (invoices and updates go there)." }, { status: 422 });
  if (!c.phone?.trim()) return NextResponse.json({ ok: false, error: "Customer phone is required." }, { status: 422 });
  const lines = (body.items ?? []).filter((l) => l && l.name?.trim() && Number(l.qty) > 0);
  if (!lines.length) return NextResponse.json({ ok: false, error: "Add at least one line item." }, { status: 422 });

  // Build items in the checkout shape.
  const items: Record<string, unknown>[] = [];
  for (const l of lines) {
    const qty = Math.max(1, Math.round(Number(l.qty)));
    if (l.kind === "catalogue" && l.id) {
      const p = await fetchProduct(l.id);
      if (!p) return NextResponse.json({ ok: false, error: `Catalogue product not found: ${l.id}` }, { status: 422 });
      const rate = l.gstRate ?? gstRateFor(p.cat, p.gstRate);
      const priceIncl = l.priceEx != null && l.priceEx > 0 ? r2(l.priceEx * (1 + rate)) : r2(p.price);
      items.push({ id: p.id, name: p.name, qty, price: priceIncl, cat: p.cat, gstRate: rate, hsn: l.hsn?.trim() || p.hsn || undefined, unit: l.unit || p.unit, priceEx: r2(priceIncl / (1 + rate)), ...(l.priceEx != null && r2(l.priceEx * (1 + rate)) !== r2(p.price) ? { listPrice: p.price } : {}), ...(l.note ? { note: l.note.slice(0, 200) } : {}) });
    } else {
      const rate = Number.isFinite(l.gstRate) ? Number(l.gstRate) : 0.18;
      const priceEx = Number(l.priceEx);
      if (!Number.isFinite(priceEx) || priceEx <= 0) return NextResponse.json({ ok: false, error: `Enter an ex-GST unit price for "${l.name}".` }, { status: 422 });
      const priceIncl = r2(priceEx * (1 + rate));
      items.push({ id: `custom-${slug(l.name)}-${Math.random().toString(36).slice(2, 6)}`, name: l.name.trim().slice(0, 200), qty, price: priceIncl, cat: l.cat?.trim() || "Custom", gstRate: rate, hsn: l.hsn?.trim() || undefined, unit: l.unit || "pc", priceEx: r2(priceEx), custom: true, ...(l.note ? { note: l.note.slice(0, 200) } : {}) });
    }
  }

  const goodsIncl = r2(items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0));
  const discount = Math.max(0, r2(Number(body.discountAmount) || 0));
  const shippingFee = Math.max(0, r2(Number(body.shippingFee) || 0));
  const goodsNet = Math.max(0, r2(goodsIncl - discount));
  const scale = goodsIncl > 0 ? goodsNet / goodsIncl : 1;
  const subtotal = r2(items.reduce((s, i) => s + (Number(i.price) / (1 + Number(i.gstRate))) * Number(i.qty), 0) * scale);
  const total = r2(goodsNet + shippingFee);

  const now = new Date().toISOString();
  const status = body.status ?? "confirmed";
  const source = (body.source || "phone").slice(0, 40);
  const id = orderId();
  const phone = normalisePhoneE164(c.phone) ?? c.phone.trim();
  const noteParts = [`Custom order (${source}) created in admin`, body.paid ? `paid via ${body.paymentMethod}` : `payment pending (${body.paymentMethod})`, body.adminNote?.trim()].filter(Boolean);

  const row: Record<string, unknown> = {
    id,
    email: c.email.trim().toLowerCase(),
    name: c.name.trim(),
    phone,
    gstin: c.gstin?.trim() || null,
    billing_address: (c.billingAddress || c.shippingAddress || "").trim(),
    shipping_address: (c.shippingAddress || c.billingAddress || "").trim(),
    payment_method: body.paymentMethod,
    items,
    product_ids: items.map((i) => String(i.id)),
    subtotal,
    total,
    shipping_fee: shippingFee,
    discount_amount: discount || null,
    is_guest: true,
    user_id: null,
    status,
    paid_at: body.paid ? now : null,
    confirmed_at: status === "confirmed" || status === "packed" ? now : null,
    admin_note: noteParts.join(" · ").slice(0, 1000),
    order_kind: "custom",
    ...(c.addressDetails && typeof c.addressDetails === "object" ? { address_details: c.addressDetails } : {}),
  };

  let { error } = await db.from("orders").insert(row);
  // Resilience like checkout: drop optional columns an older schema lacks.
  for (const col of ["order_kind", "address_details", "confirmed_at", "paid_at", "shipping_fee", "discount_amount"]) {
    if (error && new RegExp(col).test(error.message)) { delete row[col]; ({ error } = await db.from("orders").insert(row)); }
  }
  if (error) return NextResponse.json({ ok: false, error: `Could not save the order: ${error.message}` }, { status: 500 });

  try { await db.from("order_events").insert({ order_id: id, status, note: noteParts.slice(0, 2).join(" · ") }); } catch { /* optional */ }

  // Emails are opt-in here: a phone customer may not want the web flow's mail.
  let emailed = false;
  if (body.emailCustomer) {
    const like = { id, name: row.name as string, email: row.email as string, phone, total, items: items.map((i) => ({ name: String(i.name), qty: Number(i.qty), price: Number(i.price) })), shipping_address: row.shipping_address as string, shipping_fee: shippingFee, gstin: row.gstin as string | null };
    const [cust] = await Promise.all([sendCustomerOrderConfirmation(like), sendAdminNewOrder(like)]);
    emailed = !!cust.ok;
  }
  return NextResponse.json({ ok: true, orderId: id, total, subtotal, emailed });
}
