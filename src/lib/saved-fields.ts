import { adminClient } from "@/lib/supabase/admin";
import { inspectGstin } from "@/lib/gstin";

/**
 * Saved GSTINs and phone numbers (migration 0089).
 *
 * These behave exactly like saved addresses: captured automatically from what
 * the customer types at checkout, offered back as a pick-list next time, and
 * editable in account settings. An enterprise can hold several GST
 * registrations, and a buyer can have a different number for the site than for
 * accounts, so neither is a single value on the profile.
 *
 * Each of the three lists is independent on purpose. A repeat order might
 * change the address but not the GSTIN, the GSTIN but not the address, both,
 * or neither, and the checkout has to make all four cases equally easy.
 */

export type SavedGstin = { id: string; gstin: string; label: string; state: string; lastUsedAt: string };
export type SavedPhone = { id: string; phone: string; label: string; source: string; lastUsedAt: string };

/** Human wording for where a number came from, so account settings can say
 *  which is which instead of listing three anonymous numbers. */
export const PHONE_SOURCE_LABEL: Record<string, string> = {
  account: "Account contact",
  onboarding: "Given at sign-up",
  checkout: "Used at checkout",
  delivery: "Delivery contact",
  billing: "Billing contact",
  manual: "Added by you",
};

const norm = (e: string) => e.trim().toLowerCase();

export async function getSavedGstins(email: string): Promise<SavedGstin[]> {
  const db = adminClient();
  if (!db || !email) return [];
  try {
    const { data } = await db
      .from("saved_gstins").select("*").eq("email", norm(email))
      .order("last_used_at", { ascending: false }).limit(20);
    return (data ?? []).map((r) => ({
      id: r.id,
      gstin: r.gstin,
      label: r.label ?? "",
      state: r.state || inspectGstin(r.gstin).state || "",
      lastUsedAt: r.last_used_at,
    }));
  } catch {
    return []; // table not migrated yet: checkout still works, just without the picker
  }
}

export async function getSavedPhones(email: string): Promise<SavedPhone[]> {
  const db = adminClient();
  if (!db || !email) return [];
  try {
    const { data } = await db
      .from("saved_phones").select("*").eq("email", norm(email))
      .order("last_used_at", { ascending: false }).limit(20);
    return (data ?? []).map((r) => ({
      id: r.id, phone: r.phone, label: r.label ?? "", source: r.source ?? "checkout", lastUsedAt: r.last_used_at,
    }));
  } catch {
    return [];
  }
}

/** Remember a GSTIN seen on an order. Best-effort; never blocks an order. */
export async function rememberGstin(
  db: NonNullable<ReturnType<typeof adminClient>>,
  o: { email: string; gstin?: string | null; user_id?: string | null; label?: string | null }
): Promise<void> {
  const g = (o.gstin ?? "").trim().toUpperCase();
  if (!g) return;
  const check = inspectGstin(g);
  if (!check.valid) return; // never bank a GSTIN that fails its own check digit
  try {
    await db.from("saved_gstins").upsert(
      {
        email: norm(o.email), gstin: g, user_id: o.user_id ?? null,
        state: check.state ?? null,
        ...(o.label ? { label: o.label } : {}),
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "email,gstin" }
    );
  } catch { /* table absent or transient */ }
}

/** Remember a phone number, tagged with where it came from. */
export async function rememberPhone(
  db: NonNullable<ReturnType<typeof adminClient>>,
  o: { email: string; phone?: string | null; user_id?: string | null; source?: string }
): Promise<void> {
  const p = (o.phone ?? "").trim();
  if (!p) return;
  try {
    // Only set `source` on insert: a number first seen at checkout that is
    // later confirmed as the account contact should keep the better label,
    // and re-ordering should not downgrade it back to "used at checkout".
    const { data: existing } = await db
      .from("saved_phones").select("id").eq("email", norm(o.email)).eq("phone", p).maybeSingle();
    if (existing) {
      await db.from("saved_phones").update({ last_used_at: new Date().toISOString() }).eq("id", existing.id);
      return;
    }
    await db.from("saved_phones").insert({
      email: norm(o.email), phone: p, user_id: o.user_id ?? null,
      source: o.source ?? "checkout", last_used_at: new Date().toISOString(),
    });
  } catch { /* table absent or transient */ }
}

/**
 * The minimum-one rule: once a customer has any saved GSTIN, address or phone,
 * they cannot delete the last one. Removing every address would leave the next
 * checkout with nothing to offer, which is the exact retyping this whole
 * feature exists to end.
 */
export const LAST_ONE_MESSAGE = "This is your only one left. Add another first, then remove this.";
