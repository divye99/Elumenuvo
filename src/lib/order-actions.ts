"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exGst, gstPart, baseExGst, unitPriceFor } from "@/lib/pricing";
import { COUNTRIES, DEFAULT_COUNTRY, phoneError, toE164 } from "@/lib/phone";
import { sendAdminNewOrder, sendCustomerOrderConfirmation } from "@/lib/email";
import { saveAddressFromOrder } from "@/lib/addresses";
import { createRazorpayOrder, verifyPaymentSignature, razorpayConfigured, razorpayKeyId } from "@/lib/razorpay";

/** Validate a submitted phone against the country its dial code names.
 *  Longest dial code first, so "+971…" is not mistaken for "+9…". */
function normalisePhone(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLongestDial) {
    if (digits.startsWith(c.dial)) {
      const hit = toE164(digits.slice(c.dial.length), c);
      if (hit) return hit;
    }
  }
  return toE164(digits, DEFAULT_COUNTRY); // bare national number, assume India
}

export type CheckoutItem = { id: string; name: string; qty: number; price: number; cat?: string; gstRate?: number; hsn?: string };
export type StructuredOrderAddress = { line1: string; line2: string; line3: string; city: string; district: string; state: string; pin: string; country: string };
export type PlaceOrderInput = {
  name: string;
  phone: string;
  email: string;
  billing_address: string;
  shipping_address: string;
  gstin?: string;
  payment_method: string; // 'cod' | 'online'
  items: CheckoutItem[];
  discount_code?: string;
  // Structured delivery address: what saved_addresses is built from once the
  // order is paid (the composed strings above cannot repopulate a form).
  address_details?: { shipping: StructuredOrderAddress };
};
export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number }
  | { ok: false; error: string };

function orderId(): string {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ELM-${ym}-${rand}`;
}

/** Validate the checkout input and RE-PRICE every line from the database.
 *  The client's prices are never trusted: the unit price is the live
 *  elume_price with the wholesale tier (-5% at 15+ units, as promised on the
 *  product page and in the Terms) applied per line. */
async function validate(
  db: NonNullable<ReturnType<typeof adminClient>>,
  input: PlaceOrderInput
): Promise<{ ok: true; items: CheckoutItem[]; total: number } | { ok: false; error: string }> {
  const raw = (input.items ?? []).filter((i) => i.id && Number.isFinite(i.qty) && i.qty > 0);
  if (raw.length === 0) return { ok: false, error: "Your cart is empty." };
  if (!input.name.trim()) return { ok: false, error: "Please enter your name." };
  // The browser sends E.164 ("+919876543210"); pick the country back out of it
  // and re-check the length here, because a form can be bypassed.
  const e164 = normalisePhone(input.phone);
  if (!e164) return { ok: false, error: phoneError(input.phone, DEFAULT_COUNTRY) ?? "Please enter a valid mobile number." };
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return { ok: false, error: "Please enter a valid email." };
  if (!input.billing_address.trim()) return { ok: false, error: "Please enter a billing address." };
  if (!input.shipping_address.trim()) return { ok: false, error: "Please enter a shipping address." };

  const ids = [...new Set(raw.map((i) => i.id))];
  const { data, error } = await db.from("products").select("id,name,category,elume_price,is_active,gst_rate,hsn,in_stock").in("id", ids);
  if (error) return { ok: false, error: "We could not verify prices just now. Please try again." };
  const byId = new Map((data ?? []).map((p) => [p.id, p]));

  const items: CheckoutItem[] = [];
  for (const i of raw) {
    const p = byId.get(i.id);
    if (!p || p.is_active === false) {
      return { ok: false, error: `"${i.name || i.id}" is no longer available. Please remove it from your cart and try again.` };
    }
    // Out of stock is enforced HERE, not just in the UI: a cart can be days
    // old, or restored from localStorage after the item went out of stock.
    if ((p as { in_stock?: boolean | null }).in_stock === false) {
      return { ok: false, error: `"${p.name}" is out of stock right now. Please remove it from your cart to continue.` };
    }
    const qty = Math.min(Math.floor(i.qty), 9999);
    // The GST rate comes from the product row, never the browser - a per-product
    // rate (solar etc.) overrides the category rate at invoicing time.
    const meta = p as { gst_rate?: number | string | null; hsn?: string | null };
    const gstRate = meta.gst_rate;
    items.push({
      id: i.id, name: p.name, qty,
      price: unitPriceFor(Number(p.elume_price), qty),
      cat: p.category,
      ...(gstRate != null ? { gstRate: Number(gstRate) } : {}),
      ...(meta.hsn ? { hsn: meta.hsn } : {}),
    });
  }
  const total = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  return { ok: true, items, total };
}

/** Insert the order row as AWAITING PAYMENT (no emails yet - nothing is paid). */
/** Validate a discount code for this email. Returns the percent or an error.
 *  Consumption happens at markOrderPaid - an abandoned checkout never burns
 *  a one-time code. */
export async function checkDiscountCode(
  code: string,
  email: string
): Promise<{ ok: true; percent: number } | { ok: false; error: string }> {
  const db = adminClient();
  if (!db) return { ok: false, error: "Discounts unavailable right now." };
  const cc = code.trim().toUpperCase();
  if (!cc) return { ok: false, error: "Enter a code." };
  const { data: d } = await db.from("discount_codes").select("*").eq("code", cc).maybeSingle();
  if (!d) return { ok: false, error: "That code doesn't exist." };
  if (new Date(d.expires_at).getTime() < Date.now()) return { ok: false, error: "That code has expired." };
  if (d.used_count >= d.max_uses) return { ok: false, error: "That code has already been used." };
  if (d.email_lock && d.email_lock.toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false, error: "That code belongs to a different email address." };
  }
  return { ok: true, percent: Number(d.percent) };
}

async function insertPendingOrder(
  db: NonNullable<ReturnType<typeof adminClient>>,
  id: string,
  input: PlaceOrderInput,
  items: CheckoutItem[],
  total: number,
  razorpayOrderId: string,
  discountCode: string | null = null,
  discountAmount = 0
): Promise<{ ok: true } | { ok: false; error: string }> {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* guest */ }

  const row: Record<string, unknown> = {
    id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: normalisePhone(input.phone) ?? input.phone.trim(),
    gstin: input.gstin?.trim() || null,
    billing_address: input.billing_address.trim(),
    shipping_address: input.shipping_address.trim(),
    payment_method: "online",
    items,
    product_ids: items.map((i) => i.id),
    // Taxable value = sum of each item's ex-GST base at its own GST rate,
    // scaled down proportionally when a discount applies - GST is charged on
    // what the customer actually pays, so subtotal + GST always equals total.
    subtotal: (() => {
      const gross = items.some((i) => i.cat)
        ? items.reduce((s, i) => s + baseExGst(i.price, i.cat, i.gstRate) * i.qty, 0)
        : Math.round(exGst(total + discountAmount) * 100) / 100;
      const preDiscount = total + discountAmount;
      const scale = preDiscount > 0 ? total / preDiscount : 1;
      return Math.round(gross * scale * 100) / 100;
    })(),
    total,
    discount_code: discountCode,
    discount_amount: discountAmount || null,
    is_guest: !userId,
    user_id: userId,
    status: "awaiting_payment",
    razorpay_order_id: razorpayOrderId,
    ...(input.address_details?.shipping?.line1 ? { address_details: input.address_details } : {}),
  };

  let { error } = await db.from("orders").insert(row);
  // The address_details column ships in migration 0076; until it is run,
  // retry without it so ordering never breaks on the schema gap.
  if (error && "address_details" in row && /address_details/.test(error.message)) {
    delete row.address_details;
    ({ error } = await db.from("orders").insert(row));
  }
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type PaidResult = { ok: true; newlyPaid: boolean; orderId: string; total: number } | { ok: false; error: string };

/**
 * Mark an awaiting-payment order as paid. IDEMPOTENT and race-safe: the update
 * is conditional on the row still being `awaiting_payment`, so whichever of the
 * browser callback and the webhook gets there first wins, and only that one
 * sends the confirmation emails. The other is a no-op.
 */
export async function markOrderPaid(
  db: NonNullable<ReturnType<typeof adminClient>>,
  orderId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string
): Promise<PaidResult> {
  // The order must exist and belong to this Razorpay order - never trust a
  // caller to name an arbitrary order id.
  const { data: order } = await db.from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.razorpay_order_id && order.razorpay_order_id !== razorpayOrderId) {
    return { ok: false, error: "Payment does not match this order." };
  }

  const { data: updated } = await db
    .from("orders")
    .update({ status: "placed", paid_at: new Date().toISOString(), razorpay_payment_id: razorpayPaymentId })
    .eq("id", orderId)
    .in("status", ["awaiting_payment", "payment_abandoned"]) // late UPI captures recover swept orders // ← the idempotency guard
    .select("id");

  const newlyPaid = !!updated && updated.length > 0;
  if (!newlyPaid) {
    // Already marked paid by the other path; nothing more to do.
    return { ok: true, newlyPaid: false, orderId, total: Number(order.total) };
  }

  try { await db.from("order_events").insert({ order_id: orderId, status: "placed", note: "Order placed · paid online" }); } catch { /* table may not exist */ }
  // Money landed: remember this delivery address + phone for one-tap reuse
  // on the next checkout. Best-effort, never blocks the payment.
  await saveAddressFromOrder(db, order);
  // Consume the discount code only now that money actually landed.
  if (order.discount_code) {
    try {
      // Atomic, capped increment (migration 0058); falls back to
      // read-then-write if the function hasn't been created yet.
      const { error: rpcErr } = await db.rpc("consume_discount_code", { p_code: order.discount_code });
      if (rpcErr) {
        const { data: dc } = await db.from("discount_codes").select("used_count").eq("code", order.discount_code).maybeSingle();
        if (dc) await db.from("discount_codes").update({ used_count: Number(dc.used_count) + 1 }).eq("code", order.discount_code);
      }
    } catch { /* never block payment on this */ }
  }
  const mail = {
    id: orderId, email: order.email, name: order.name, phone: order.phone,
    total: Number(order.total), items: order.items ?? [],
    shipping_address: order.shipping_address, gstin: order.gstin ?? null,
  };
  await Promise.allSettled([sendAdminNewOrder(mail), sendCustomerOrderConfirmation(mail)]);
  return { ok: true, newlyPaid: true, orderId, total: Number(order.total) };
}

/* ── Online payment (Razorpay) - the only payment path.
 *    Pay-on-delivery was retired; its placeOrder() action was removed so a
 *    stale caller can't create an unpaid COD order. ── */

export type StartPaymentResult =
  | { ok: true; orderId: string; razorpayOrderId: string; keyId: string; amount: number; name: string; email: string; phone: string }
  | { ok: false; error: string };

/** Whether the storefront should offer online payment (keys present). */
export async function onlinePaymentAvailable(): Promise<boolean> {
  return razorpayConfigured();
}

/**
 * Step 1 of online payment: validate, compute the amount server-side, create the
 * Razorpay order, and PERSIST the order as `awaiting_payment` before the payment
 * window opens. Writing it up-front is what lets the webhook recover a payment
 * whose browser callback never came back (customer closed the tab, lost signal,
 * app-switched mid-UPI) - otherwise they'd be charged with no order to show.
 */
export async function startOnlinePayment(input: PlaceOrderInput): Promise<StartPaymentResult> {
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't set up yet. Please try again shortly." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Ordering isn't available right now." };
  const v = await validate(db, input);
  if (!v.ok) return v;

  // Apply a discount code AFTER re-pricing - always on OUR numbers.
  let discount = 0;
  let appliedCode: string | null = null;
  if (input.discount_code?.trim()) {
    const dc = await checkDiscountCode(input.discount_code, input.email);
    if (!dc.ok) return { ok: false, error: dc.error };
    discount = Math.round(v.total * (dc.percent / 100) * 100) / 100;
    appliedCode = input.discount_code.trim().toUpperCase();
  }
  const payable = Math.round((v.total - discount) * 100) / 100;
  if (payable < 1) return { ok: false, error: "Order total too small." };

  const id = orderId();
  const rp = await createRazorpayOrder(Math.round(payable * 100), id, { orderId: id, email: input.email.trim().toLowerCase() });
  if (!rp.ok) return { ok: false, error: rp.error };

  const pending = await insertPendingOrder(db, id, input, v.items, payable, rp.id, appliedCode, discount);
  if (!pending.ok) return { ok: false, error: pending.error };

  return {
    ok: true, orderId: id, razorpayOrderId: rp.id, keyId: razorpayKeyId(), amount: Math.round(payable * 100),
    name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: normalisePhone(input.phone) ?? input.phone.trim(),
  };
}

/**
 * Step 2 (fast path): the browser came back with a success payload. Verify the
 * signature and mark the pending order paid. The webhook is the safety net that
 * does exactly the same thing if this never runs; whichever lands first wins.
 * Nothing here trusts the client - the amount and contents come from the row we
 * wrote in step 1.
 */
export async function confirmOnlinePayment(
  payment: { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<PlaceOrderResult> {
  if (!verifyPaymentSignature(payment.razorpay_order_id, payment.razorpay_payment_id, payment.razorpay_signature)) {
    return { ok: false, error: "Payment could not be verified. If you were charged, contact support with your payment id." };
  }
  const db = adminClient();
  if (!db) return { ok: false, error: "Ordering isn't available right now." };

  const res = await markOrderPaid(db, payment.orderId, payment.razorpay_order_id, payment.razorpay_payment_id);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, orderId: res.orderId, total: res.total };
}

/** GST split for a GST-inclusive amount (checkout summary). */
export async function gstSplit(inclusive: number): Promise<{ base: number; gst: number }> {
  return { base: Math.round(exGst(inclusive) * 100) / 100, gst: Math.round(gstPart(inclusive) * 100) / 100 };
}
