/**
 * GA4 purchase tracking. The order payload travels checkout -> /order-confirmed
 * through sessionStorage (never the URL - order value and email are not for
 * query strings), and the purchase event fires exactly once per order id.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type PurchasePayload = {
  orderId: string;
  total: number;
  email: string;
  signedIn: boolean;
  items: { id: string; name: string; qty: number; price: number }[];
};

const KEY = "elume:last-order";

export function stashOrder(p: PurchasePayload) {
  try { sessionStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ }
}

export function readOrder(): PurchasePayload | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PurchasePayload) : null;
  } catch { return null; }
}

/** Fire the GA4 purchase event once per order (refreshes must not double-count). */
export function trackPurchase(p: PurchasePayload) {
  const onceKey = `elume:ga-purchase:${p.orderId}`;
  try { if (localStorage.getItem(onceKey)) return; } catch { /* fall through */ }
  window.gtag?.("event", "purchase", {
    transaction_id: p.orderId,
    value: p.total,
    currency: "INR",
    items: p.items.map((i) => ({ item_id: i.id, item_name: i.name, quantity: i.qty, price: i.price })),
  });
  try { localStorage.setItem(onceKey, "1"); } catch { /* private mode */ }
}
