import { randomBytes } from "crypto";
import { adminClient } from "@/lib/supabase/admin";
import type { CheckoutItem } from "@/lib/order-actions";

/**
 * Custom orders (migration 0131): an admin-prepared order the customer
 * completes through a link at /order/<token>. The row is the server-side
 * source of truth for items and prices; checkout never re-prices it.
 */

export type CustomOrderCustomer = { name?: string; email?: string; phone?: string; gstin?: string; billing?: string; shipping?: string };
export type CustomOrderItem = CheckoutItem & { unit?: string; priceEx?: number; custom?: boolean; note?: string; listPrice?: number };
export type CustomOrderRow = {
  token: string;
  created_at: string;
  expires_at: string;
  status: "open" | "converted" | "cancelled" | "expired";
  customer: CustomOrderCustomer;
  items: CustomOrderItem[];
  shipping_fee: number | null;
  discount_amount: number;
  note: string | null;
  admin_note: string | null;
  source: string | null;
  converted_order_id: string | null;
  converted_at: string | null;
};

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i lookalikes
export function newToken(len = 14): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://elumenuvo.com").replace(/\/+$/, "");
export const customOrderUrl = (token: string) => `${SITE}/order/${token}`;

export async function getCustomOrder(token: string): Promise<CustomOrderRow | null> {
  const db = adminClient();
  if (!db || !token) return null;
  const { data } = await db.from("custom_orders").select("*").eq("token", token).maybeSingle();
  return (data as CustomOrderRow | null) ?? null;
}

/** Open and not expired: the only state a customer may pay against. */
export function isPayable(co: CustomOrderRow | null): co is CustomOrderRow {
  return !!co && co.status === "open" && new Date(co.expires_at).getTime() > Date.now();
}

export function customOrderTotals(co: Pick<CustomOrderRow, "items" | "discount_amount">) {
  const goods = Math.round(co.items.reduce((s, i) => s + Number(i.price) * Number(i.qty), 0) * 100) / 100;
  const discount = Math.max(0, Number(co.discount_amount) || 0);
  return { goods, discount, goodsPayable: Math.max(0, Math.round((goods - discount) * 100) / 100) };
}
