"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exGst, gstPart, baseExGst } from "@/lib/pricing";
import { sendAdminNewOrder, sendCustomerOrderConfirmation } from "@/lib/email";
import { createRazorpayOrder, verifyPaymentSignature, razorpayConfigured, razorpayKeyId } from "@/lib/razorpay";

export type CheckoutItem = { id: string; name: string; qty: number; price: number; cat?: string };
export type PlaceOrderInput = {
  name: string;
  phone: string;
  email: string;
  billing_address: string;
  shipping_address: string;
  gstin?: string;
  payment_method: string; // 'cod' | 'online'
  items: CheckoutItem[];
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

/** Validate the checkout input; returns cleaned items + total, or an error. */
function validate(input: PlaceOrderInput): { ok: true; items: CheckoutItem[]; total: number } | { ok: false; error: string } {
  const items = (input.items ?? []).filter((i) => i.id && i.qty > 0 && i.price > 0);
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };
  if (!input.name.trim()) return { ok: false, error: "Please enter your name." };
  if (!/^[0-9+\-\s]{8,15}$/.test(input.phone.trim())) return { ok: false, error: "Please enter a valid phone number." };
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return { ok: false, error: "Please enter a valid email." };
  if (!input.billing_address.trim()) return { ok: false, error: "Please enter a billing address." };
  if (!input.shipping_address.trim()) return { ok: false, error: "Please enter a shipping address." };
  const total = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  return { ok: true, items, total };
}

/** Insert the order row (+ timeline + notifications). Shared by COD and paid-online. */
async function writeOrder(
  db: NonNullable<ReturnType<typeof adminClient>>,
  id: string,
  input: PlaceOrderInput,
  items: CheckoutItem[],
  total: number,
  extra: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; error: string }> {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* guest */ }

  const { error } = await db.from("orders").insert({
    id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    phone: input.phone.trim(),
    gstin: input.gstin?.trim() || null,
    billing_address: input.billing_address.trim(),
    shipping_address: input.shipping_address.trim(),
    payment_method: input.payment_method,
    items,
    product_ids: items.map((i) => i.id),
    // Taxable value = sum of each item's ex-GST base at its category rate
    // (falls back to the flat split if items predate the cat field).
    subtotal: items.some((i) => i.cat)
      ? items.reduce((s, i) => s + baseExGst(i.price, i.cat) * i.qty, 0)
      : Math.round(exGst(total) * 100) / 100,
    total,
    is_guest: !userId,
    user_id: userId,
    status: "placed",
    ...extra,
  });
  if (error) return { ok: false, error: error.message };

  const order = {
    id, email: input.email.trim().toLowerCase(), name: input.name.trim(), phone: input.phone.trim(),
    total, items, shipping_address: input.shipping_address.trim(), gstin: input.gstin?.trim() || null,
  };
  const note = input.payment_method === "online" ? "Order placed · paid online" : "Order placed";
  try { await db.from("order_events").insert({ order_id: id, status: "placed", note }); } catch { /* table may not exist yet */ }
  await Promise.allSettled([sendAdminNewOrder(order), sendCustomerOrderConfirmation(order)]);
  return { ok: true };
}

/** Place a Pay-on-delivery order. GST-inclusive prices; total = sum(price × qty). */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const v = validate(input);
  if (!v.ok) return v;
  const db = adminClient();
  if (!db) return { ok: false, error: "Ordering isn't available right now." };

  const id = orderId();
  const res = await writeOrder(db, id, { ...input, payment_method: "cod" }, v.items, v.total, {});
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, orderId: id, total: v.total };
}

/* ── Online payment (Razorpay) ── */

export type StartPaymentResult =
  | { ok: true; orderId: string; razorpayOrderId: string; keyId: string; amount: number; name: string; email: string; phone: string }
  | { ok: false; error: string };

/** Whether the storefront should offer online payment (keys present). */
export async function onlinePaymentAvailable(): Promise<boolean> {
  return razorpayConfigured();
}

/**
 * Step 1 of online payment: validate, compute the amount server-side, and create
 * a Razorpay order. No DB row is written yet — the order is only persisted once
 * payment is verified, so abandoned attempts leave nothing behind.
 */
export async function startOnlinePayment(input: PlaceOrderInput): Promise<StartPaymentResult> {
  const v = validate(input);
  if (!v.ok) return v;
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't set up. Use Pay on delivery." };

  const id = orderId();
  const rp = await createRazorpayOrder(Math.round(v.total * 100), id, { orderId: id, email: input.email.trim().toLowerCase() });
  if (!rp.ok) return { ok: false, error: rp.error };

  return {
    ok: true, orderId: id, razorpayOrderId: rp.id, keyId: razorpayKeyId(), amount: Math.round(v.total * 100),
    name: input.name.trim(), email: input.email.trim().toLowerCase(), phone: input.phone.trim(),
  };
}

/**
 * Step 2: verify the Razorpay signature, then persist the (now paid) order and
 * fire the confirmation. Recomputes the total server-side — never trusts the client.
 */
export async function confirmOnlinePayment(
  input: PlaceOrderInput,
  payment: { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
): Promise<PlaceOrderResult> {
  const v = validate(input);
  if (!v.ok) return v;
  if (!verifyPaymentSignature(payment.razorpay_order_id, payment.razorpay_payment_id, payment.razorpay_signature)) {
    return { ok: false, error: "Payment could not be verified. If you were charged, contact support with your payment id." };
  }
  const db = adminClient();
  if (!db) return { ok: false, error: "Ordering isn't available right now." };

  const res = await writeOrder(db, payment.orderId, { ...input, payment_method: "online" }, v.items, v.total, {
    razorpay_order_id: payment.razorpay_order_id,
    razorpay_payment_id: payment.razorpay_payment_id,
    paid_at: new Date().toISOString(),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, orderId: payment.orderId, total: v.total };
}

/** GST split for a GST-inclusive amount (checkout summary). */
export async function gstSplit(inclusive: number): Promise<{ base: number; gst: number }> {
  return { base: Math.round(exGst(inclusive) * 100) / 100, gst: Math.round(gstPart(inclusive) * 100) / 100 };
}
