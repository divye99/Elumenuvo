"use server";

import { adminClient } from "@/lib/supabase/admin";
import { getProfile, isBusiness } from "@/lib/profile";
import { isMetalCategory, lotKg } from "@/lib/metals";
import { createRazorpayOrder, verifyPaymentSignature, razorpayConfigured, razorpayKeyId } from "@/lib/razorpay";
import { markOrderPaid } from "@/lib/order-actions";
import { saveAddressFromOrder } from "@/lib/addresses";
import { baseExGst } from "@/lib/pricing";
import { DEFAULT_COUNTRY, phoneError, normalisePhoneE164 } from "@/lib/phone";

/**
 * Copper booking flow (metals only, business accounts only).
 *
 * Lakh-scale lots cannot run through the normal full-amount checkout, so a
 * booking collects a 5% TOKEN online via Razorpay - locking the quoted rate -
 * and the balance settles by RTGS (bank details from the `metals_bank`
 * content block; admin marks the balance received on the order). The order
 * row stores the FULL value in `total` (invoicing truth) with
 * order_kind='metals_booking', token_amount and balance_due alongside; the
 * webhook and markOrderPaid know to verify the TOKEN amount for these orders.
 */
// Mirrored as local constants in BookingClient ("use server" modules may only
// export async functions, so these can't be exported from here).
const TOKEN_PCT = 0.05;
const MAX_LOTS = 10;

export type MetalsBank = { account_name?: string; account_number?: string; ifsc?: string; bank?: string; branch?: string; note?: string };

/** The RTGS bank block (admin → Content → metals_bank). Null-safe pre-0090. */
export async function getMetalsBank(): Promise<MetalsBank | null> {
  const db = adminClient();
  if (!db) return null;
  try {
    const { data } = await db.from("content").select("data").eq("key", "metals_bank").maybeSingle();
    const bank = (data?.data ?? null) as MetalsBank | null;
    return bank && (bank.account_number || "").trim() ? bank : null;
  } catch {
    return null;
  }
}

function bookingId(): string {
  const d = new Date();
  const ym = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `ELM-CU-${ym}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export type StartBookingResult =
  | { ok: true; orderId: string; razorpayOrderId: string; keyId: string; amount: number; name: string; email: string; phone: string }
  | { ok: false; error: string };

export async function startMetalsBooking(input: {
  productId: string;
  lots: number;
  phone: string;
  shipping_address: string;
}): Promise<StartBookingResult> {
  if (!razorpayConfigured()) return { ok: false, error: "Online booking isn't available right now. Please try again shortly." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Booking isn't available right now." };

  // The gate the whole feature stands on: verified business buyers only.
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Please sign in to book copper." };
  if (!isBusiness(profile) || !profile.gstin) {
    return { ok: false, error: "Copper booking needs a business account with a GSTIN on file." };
  }

  const lots = Math.floor(Number(input.lots));
  if (!Number.isFinite(lots) || lots < 1 || lots > MAX_LOTS) {
    return { ok: false, error: `Quantity must be between 1 and ${MAX_LOTS} lots.` };
  }
  const e164 = normalisePhoneE164(input.phone);
  if (!e164) return { ok: false, error: phoneError(input.phone, DEFAULT_COUNTRY) ?? "Please enter a valid mobile number." };
  const shipping = input.shipping_address.trim();
  if (shipping.length < 10) return { ok: false, error: "Please enter the full delivery address." };

  // Re-price from the database - the browser's numbers are never trusted.
  const { data: p } = await db
    .from("products")
    .select("id, name, category, elume_price, unit, attrs, is_active, in_stock, gst_rate")
    .eq("id", input.productId)
    .maybeSingle();
  if (!p || !isMetalCategory(p.category)) return { ok: false, error: "This product can't be booked here." };
  if (p.is_active === false || p.in_stock === false) return { ok: false, error: "This product isn't bookable right now." };

  const unitPrice = Number(p.elume_price);
  const total = Math.round(unitPrice * lots * 100) / 100;
  const token = Math.round(total * TOKEN_PCT * 100) / 100;
  const balance = Math.round((total - token) * 100) / 100;
  if (token < 1) return { ok: false, error: "Order total too small." };

  const id = bookingId();
  const email = (profile.email ?? "").trim().toLowerCase();
  if (!email) return { ok: false, error: "Your account has no email on file." };
  const rp = await createRazorpayOrder(Math.round(token * 100), id, { orderId: id, email, kind: "metals_token" });
  if (!rp.ok) return { ok: false, error: rp.error };

  const row: Record<string, unknown> = {
    id,
    email,
    name: profile.full_name || profile.company || "Business buyer",
    phone: e164,
    gstin: profile.gstin,
    billing_address: shipping,
    shipping_address: shipping,
    payment_method: "online",
    items: [{ id: p.id, name: `${p.name}${p.attrs?.Lot ? ` · ${p.attrs.Lot} lot` : ""}`, qty: lots, price: unitPrice }],
    product_ids: [p.id],
    subtotal: Math.round(baseExGst(unitPrice, p.category, p.gst_rate != null ? Number(p.gst_rate) : null) * lots * 100) / 100,
    total,
    is_guest: false,
    user_id: profile.id,
    status: "awaiting_payment",
    razorpay_order_id: rp.id,
    order_kind: "metals_booking",
    token_amount: token,
    balance_due: balance,
  };
  let { error } = await db.from("orders").insert(row);
  // Booking columns ship in migration 0090; refuse (rather than silently
  // degrade) if it hasn't run - a booking without token accounting would
  // trip the webhook's amount check and confuse the admin's balance view.
  if (error && /order_kind|token_amount|balance_due/.test(error.message)) {
    return { ok: false, error: "Booking isn't fully set up yet (migration 0090 pending). Please try again shortly." };
  }
  if (error) return { ok: false, error: error.message };

  // Best-effort address bank, same as checkout.
  await saveAddressFromOrder(db, { email, name: String(row.name), phone: e164, user_id: profile.id });

  return {
    ok: true,
    orderId: id,
    razorpayOrderId: rp.id,
    keyId: razorpayKeyId(),
    amount: Math.round(token * 100),
    name: String(row.name),
    email,
    phone: e164,
  };
}

/** Fast path after the Razorpay modal succeeds; the webhook is the safety
 *  net and both funnel into the same idempotent markOrderPaid. */
export async function confirmMetalsBooking(payment: {
  orderId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> {
  if (!verifyPaymentSignature(payment.razorpay_order_id, payment.razorpay_payment_id, payment.razorpay_signature)) {
    return { ok: false, error: "Payment could not be verified. If you were charged, contact support with your payment id." };
  }
  const db = adminClient();
  if (!db) return { ok: false, error: "Booking isn't available right now." };
  const res = await markOrderPaid(db, payment.orderId, payment.razorpay_order_id, payment.razorpay_payment_id);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, orderId: res.orderId };
}
