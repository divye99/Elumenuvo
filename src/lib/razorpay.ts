/**
 * Razorpay integration via REST (no SDK dependency). Server-only.
 * Graceful: if the keys are unset, `razorpayConfigured()` is false and checkout
 * shows "payments enabling soon" with ordering paused — nothing else breaks.
 * Pay-on-delivery is retired; Razorpay is the only payment path.
 *
 * Env (set in Vercel, never committed):
 *   RAZORPAY_KEY_ID       — key id (safe to expose; sent to the browser checkout)
 *   RAZORPAY_KEY_SECRET   — server secret (order create + signature verify)
 */
import { createHmac, timingSafeEqual } from "crypto";

const KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

export function razorpayConfigured(): boolean {
  return !!(KEY_ID && KEY_SECRET);
}
export function razorpayKeyId(): string {
  return KEY_ID;
}

/** Create a Razorpay order for an amount in paise. Returns the order id. */
export async function createRazorpayOrder(amountPaise: number, receipt: string, notes?: Record<string, string>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!razorpayConfigured()) return { ok: false, error: "Online payment isn't set up." };
  if (!Number.isFinite(amountPaise) || amountPaise < 100) return { ok: false, error: "Invalid amount." };
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount: Math.round(amountPaise), currency: "INR", receipt, notes: notes ?? {} }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Razorpay ${res.status}: ${body.slice(0, 160)}` };
    }
    const data = (await res.json()) as { id?: string };
    return data.id ? { ok: true, id: data.id } : { ok: false, error: "No order id from Razorpay." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error." };
  }
}

/**
 * Verify the checkout signature. Razorpay signs `${order_id}|${payment_id}` with
 * HMAC-SHA256(key_secret); we recompute and constant-time compare.
 */
export function verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
  if (!KEY_SECRET || !razorpayOrderId || !razorpayPaymentId || !signature) return false;
  const expected = createHmac("sha256", KEY_SECRET).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
