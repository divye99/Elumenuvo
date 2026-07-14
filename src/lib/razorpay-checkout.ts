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
  orderId?: string; // our Elume order reference, shown in the payment window
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
      // Branding — the window opens as an overlay ON the Elume page (the buyer
      // never leaves the site), so make it read as ours, not a generic popup.
      name: "Elume",
      description: args.orderId ? `Order ${args.orderId}` : "Elume order",
      // Absolute URL: the checkout renders in an iframe on Razorpay's domain,
      // so a relative path would not resolve there.
      image: `${window.location.origin}/assets/elume-mark.png`,
      order_id: args.razorpayOrderId,
      prefill: { name: args.name, email: args.email, contact: args.phone },
      notes: args.orderId ? { elume_order: args.orderId } : undefined,
      theme: { color: "#4E5BDC", backdrop_color: "rgba(20,24,45,0.7)" },
      // Keep the buyer on our flow: no auto-redirect, we handle success inline.
      redirect: false,
      retry: { enabled: true, max_count: 3 },
      handler: (resp: RpSuccess) => resolve(resp),
      modal: { ondismiss: () => resolve(null), escape: true, confirm_close: true },
    });
    rzp.open();
  });
}
