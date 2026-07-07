"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { exGst, gstPart } from "@/lib/pricing";
import { sendAdminNewOrder, sendCustomerOrderConfirmation } from "@/lib/email";

export type CheckoutItem = { id: string; name: string; qty: number; price: number };
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

/** Place a storefront order (guest or signed-in). Writes to public.orders via
 *  the service-role client. GST-inclusive prices; total = sum(price × qty). */
export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const items = (input.items ?? []).filter((i) => i.id && i.qty > 0 && i.price > 0);
  if (items.length === 0) return { ok: false, error: "Your cart is empty." };
  if (!input.name.trim()) return { ok: false, error: "Please enter your name." };
  if (!/^[0-9+\-\s]{8,15}$/.test(input.phone.trim())) return { ok: false, error: "Please enter a valid phone number." };
  if (!/^\S+@\S+\.\S+$/.test(input.email.trim())) return { ok: false, error: "Please enter a valid email." };
  if (!input.billing_address.trim()) return { ok: false, error: "Please enter a billing address." };
  if (!input.shipping_address.trim()) return { ok: false, error: "Please enter a shipping address." };

  const db = adminClient();
  if (!db) return { ok: false, error: "Ordering isn't available right now." };

  // Attach the signed-in user id when present (guest otherwise).
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch { /* guest */ }

  const total = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100;
  const id = orderId();

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
    subtotal: Math.round(exGst(total) * 100) / 100,
    total,
    is_guest: !userId,
    user_id: userId,
    status: "placed",
  });
  if (error) return { ok: false, error: error.message };

  // Fulfilment timeline + notifications — all best-effort; never fail the order.
  const order = {
    id, email: input.email.trim().toLowerCase(), name: input.name.trim(), phone: input.phone.trim(),
    total, items, shipping_address: input.shipping_address.trim(), gstin: input.gstin?.trim() || null,
  };
  try { await db.from("order_events").insert({ order_id: id, status: "placed", note: "Order placed" }); } catch { /* table may not exist yet */ }
  await Promise.allSettled([sendAdminNewOrder(order), sendCustomerOrderConfirmation(order)]);

  return { ok: true, orderId: id, total };
}

/** GST split for a GST-inclusive amount (checkout summary). */
export async function gstSplit(inclusive: number): Promise<{ base: number; gst: number }> {
  return { base: Math.round(exGst(inclusive) * 100) / 100, gst: Math.round(gstPart(inclusive) * 100) / 100 };
}
