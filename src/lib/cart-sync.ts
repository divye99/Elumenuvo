"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Account-backed cart (migration 0087). localStorage stays the fast local
 * copy; this is the copy that survives a cleared browser or a switch to
 * another device.
 *
 * Merge rule on sign-in: union by product id, taking the HIGHER quantity of
 * the two. Losing something a shopper deliberately added is far worse than
 * carrying one extra unit they can adjust in the cart, and a merge is the only
 * rule that never silently empties a cart.
 *
 * Every function is best-effort. A cart is a convenience, so a database
 * hiccup, or the migration not having run yet, must never break browsing.
 */

export type SyncItem = {
  id: string; name: string; brand: string; price: number; mrp: number;
  unit: string; qty: number; cat?: string; gstRate?: number; image?: string;
};

function sane(items: unknown): SyncItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i): i is SyncItem => !!i && typeof i === "object" && typeof (i as SyncItem).id === "string")
    .map((i) => ({ ...i, qty: Math.max(1, Math.min(9999, Math.floor(Number(i.qty) || 1))) }))
    .slice(0, 200); // a cart this long is a bug or an attack, not a shopper
}

/** Merge the browser's cart into the account's and return the result.
 *  Called once when a signed-in session first mounts the cart. */
export async function mergeCart(local: SyncItem[]): Promise<{ ok: boolean; items: SyncItem[] }> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, items: sane(local) };

    const { data, error } = await db.from("user_carts").select("items").eq("user_id", user.id).maybeSingle();
    if (error) return { ok: false, items: sane(local) }; // table missing: stay local-only

    const remote = sane(data?.items);
    const byId = new Map<string, SyncItem>();
    for (const i of remote) byId.set(i.id, i);
    for (const i of sane(local)) {
      const ex = byId.get(i.id);
      byId.set(i.id, ex ? { ...ex, qty: Math.max(ex.qty, i.qty) } : i);
    }
    const merged = [...byId.values()];

    await db.from("user_carts").upsert(
      { user_id: user.id, items: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return { ok: true, items: merged };
  } catch {
    return { ok: false, items: sane(local) };
  }
}

/** Mirror the current cart to the account. Fire-and-forget from the client. */
export async function pushCart(items: SyncItem[]): Promise<{ ok: boolean }> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false };
    const { error } = await db.from("user_carts").upsert(
      { user_id: user.id, items: sane(items), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
