"use client";

/**
 * Loads Razorpay's hosted checkout.js on demand and opens the branded modal.
 * Resolves with the success payload, or null if the customer dismisses it.
 */
type RpSuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };

type OpenArgs = {
  keyId: string;
  amount: number; // paise
  razorpayOrderId: string;
  name: string;
  email: string;
  phone: string;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export async function openRazorpay(args: OpenArgs): Promise<RpSuccess | null> {
  const ready = await loadScript();
  if (!ready || !window.Razorpay) throw new Error("Couldn't load the payment window. Check your connection and try again.");

  return new Promise<RpSuccess | null>((resolve) => {
    const rzp = new window.Razorpay!({
      key: args.keyId,
      amount: args.amount,
      currency: "INR",
      name: "Elume",
      description: "Elume order",
      order_id: args.razorpayOrderId,
      prefill: { name: args.name, email: args.email, contact: args.phone },
      theme: { color: "#4E5BDC" },
      handler: (resp: RpSuccess) => resolve(resp),
      modal: { ondismiss: () => resolve(null) },
    });
    rzp.open();
  });
}
