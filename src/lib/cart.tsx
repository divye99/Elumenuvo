"use client";

/**
 * Storefront cart — client-side, localStorage-backed so guests and signed-in
 * shoppers keep a cart across visits. Separate from the workspace (AppShell)
 * cart, which is the signed-in B2B PO flow.
 */
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { baseExGst } from "@/lib/pricing";

export type CartItem = {
  id: string;
  name: string;
  brand: string;
  price: number; // GST-inclusive Elume price
  mrp: number;
  unit: string;
  cat?: string; // product category → GST rate (optional: pre-existing carts won't have it)
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
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "elume.cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

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
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const baseTotal = items.reduce((s, i) => s + baseExGst(i.price, i.cat) * i.qty, 0);
    return {
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      total,
      baseTotal,
      gstTotal: total - baseTotal,
      add, setQty, remove, clear,
    };
  }, [items, add, setQty, remove, clear]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function useCart(): Ctx {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
