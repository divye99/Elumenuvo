"use client";

/**
 * Storefront cart - client-side, localStorage-backed so guests and signed-in
 * shoppers keep a cart across visits. Separate from the workspace (AppShell)
 * cart, which is the signed-in B2B PO flow.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { baseExGst, unitPriceFor } from "@/lib/pricing";
import { mergeCart, pushCart } from "@/lib/cart-sync";

export type CartItem = {
  id: string;
  name: string;
  brand: string;
  price: number; // GST-inclusive Elume price
  mrp: number;
  unit: string;
  cat?: string; // product category → GST rate (optional: pre-existing carts won't have it)
  gstRate?: number; // per-product GST override (solar etc.); falls back to the category rate
  image?: string;
  qty: number;
};

type Ctx = {
  items: CartItem[];
  count: number;
  total: number; // GST-inclusive payable
  baseTotal: number; // ex-GST (taxable value), summed per-item at the category rate
  gstTotal: number; // total − baseTotal
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  /** False until the stored cart has been read. Screens must not announce an
   *  empty cart before this is true, or checkout flashes "Your cart is empty"
   *  at someone who is mid-purchase. */
  ready: boolean;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "elume.cart";

/**
 * Is there a Supabase session cookie in this browser?
 *
 * StoreChrome deliberately never reads the session (that would make all 3,400
 * catalogue URLs dynamic), so the provider cannot be told server-side whether
 * anyone is signed in. Without this check every anonymous page view would pay
 * for a server round-trip that can only ever answer "you are a guest".
 * A false positive costs one wasted call; a false negative just leaves the
 * cart local, which is exactly the old behaviour.
 */
function hasAuthCookie(): boolean {
  try {
    return document.cookie.split(";").some((c) => {
      const n = c.trim().split("=")[0];
      return n.startsWith("sb-") && n.includes("auth-token");
    });
  } catch {
    return false;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Loaded from localStorage first (instant), then reconciled against the
  // account's cart. `synced` gates the push effect so the merge result is not
  // immediately pushed back as if it were a local edit.
  const synced = useRef(false);

  useEffect(() => {
    let local: CartItem[] = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) local = JSON.parse(raw);
    } catch { /* ignore */ }
    if (local.length) setItems(local);

    // Reconcile with the account cart (migration 0087). Guests skip the call
    // entirely; for them the local cart is already the whole story.
    (async () => {
      try {
        if (!hasAuthCookie()) return;
        const res = await mergeCart(local as never);
        if (res.ok) {
          const merged = res.items as unknown as CartItem[];
          setItems(merged);
          try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* ignore */ }
        }
      } catch { /* stay local-only */ }
      finally { synced.current = true; setReady(true); }
    })();
  }, []);

  // Mirror every later change to the account. Guests no-op server-side.
  useEffect(() => {
    if (!synced.current || !hasAuthCookie()) return;
    const t = setTimeout(() => { void pushCart(items as never); }, 600);
    return () => clearTimeout(t);
  }, [items]);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const add = useCallback((item: Omit<CartItem, "qty">, qty = 1) => {
    setItems((prev) => {
      const ex = prev.find((i) => i.id === item.id);
      const next = ex
        ? prev.map((i) => (i.id === item.id ? { ...i, qty: i.qty + qty } : i))
        : [...prev, { ...item, qty }];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, qty } : i)).filter((i) => i.qty > 0);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => persist(items.filter((i) => i.id !== id)), [items, persist]);
  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<Ctx>(() => {
    // The wholesale tier (-5% at 15+ units, promised on every product page and
    // in the Terms) applies PER LINE via unitPriceFor. The server re-prices
    // from the database with the same rule at checkout, so what the cart shows
    // is what the customer is charged.
    const total = items.reduce((s, i) => s + unitPriceFor(i.price, i.qty) * i.qty, 0);
    const baseTotal = items.reduce((s, i) => s + baseExGst(unitPriceFor(i.price, i.qty), i.cat, i.gstRate) * i.qty, 0);
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      total,
      baseTotal,
      gstTotal: total - baseTotal,
      add, setQty, remove, clear, ready,
    };
  }, [items, add, setQty, remove, clear, ready]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): Ctx {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
