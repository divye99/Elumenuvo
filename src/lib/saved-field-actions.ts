"use server";

import { createClient } from "@/lib/supabase/server";
import { inspectGstin } from "@/lib/gstin";
import { LAST_ONE_MESSAGE } from "@/lib/saved-fields";
import { normalisePhoneE164 } from "@/lib/phone";

/**
 * Add and remove saved GSTINs, phones and addresses from account settings.
 *
 * All of these run on the USER's session, so the row-level policies from 0089
 * are what enforce ownership; nothing here re-implements that check.
 *
 * The one rule enforced here rather than in the database: you cannot delete
 * your last GSTIN, phone or address. A count check is racy in theory (two
 * tabs deleting at once), but the cost of losing that race is an empty list,
 * not a data-integrity problem, and a database-level constraint would block
 * the legitimate "delete everything then start again" path.
 */

type Res = { ok: boolean; error?: string };

const TABLES = { gstin: "saved_gstins", phone: "saved_phones", address: "saved_addresses" } as const;
export type SavedKind = keyof typeof TABLES;

async function sessionEmail() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  return { db, user, email: (user?.email ?? "").trim().toLowerCase() };
}

/** Remove one saved item, refusing to remove the last of its kind. */
export async function removeSavedItem(kind: SavedKind, id: string): Promise<Res> {
  if (!TABLES[kind] || !id) return { ok: false, error: "Nothing to remove." };
  try {
    const { db, user, email } = await sessionEmail();
    if (!user) return { ok: false, error: "Please sign in again." };

    const { count } = await db.from(TABLES[kind]).select("id", { count: "exact", head: true }).eq("email", email);
    if ((count ?? 0) <= 1) return { ok: false, error: LAST_ONE_MESSAGE };

    const { error } = await db.from(TABLES[kind]).delete().eq("id", id);
    if (error) return { ok: false, error: "Could not remove that just now." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove that just now." };
  }
}

/** Add a GSTIN by hand. Validated by its own check digit before it is saved. */
export async function addSavedGstin(gstinRaw: string, label: string): Promise<Res & { state?: string }> {
  try {
    const { db, user, email } = await sessionEmail();
    if (!user) return { ok: false, error: "Please sign in again." };
    const gstin = (gstinRaw ?? "").trim().toUpperCase();
    const check = inspectGstin(gstin);
    if (!check.valid) return { ok: false, error: check.error ?? "That GSTIN does not look right." };

    const { error } = await db.from("saved_gstins").upsert(
      {
        email, user_id: user.id, gstin, state: check.state ?? null,
        label: label.trim().slice(0, 80) || null, last_used_at: new Date().toISOString(),
      },
      { onConflict: "email,gstin" }
    );
    if (error) return { ok: false, error: "Could not save that GSTIN just now." };
    return { ok: true, state: check.state };
  } catch {
    return { ok: false, error: "Could not save that GSTIN just now." };
  }
}

/** Add a phone number by hand, normalised to E.164 so it dedupes properly. */
export async function addSavedPhone(phoneRaw: string, label: string): Promise<Res> {
  try {
    const { db, user, email } = await sessionEmail();
    if (!user) return { ok: false, error: "Please sign in again." };
    const phone = normalisePhoneE164(phoneRaw ?? "");
    if (!phone) return { ok: false, error: "Please enter a valid mobile number." };

    const { error } = await db.from("saved_phones").upsert(
      {
        email, user_id: user.id, phone, source: "manual",
        label: label.trim().slice(0, 60) || null, last_used_at: new Date().toISOString(),
      },
      { onConflict: "email,phone" }
    );
    if (error) return { ok: false, error: "Could not save that number just now." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save that number just now." };
  }
}

/** Rename a saved GSTIN or phone, so a list of numbers reads as a list of
 *  roles ("Site foreman", "Accounts") rather than digits. */
export async function labelSavedItem(kind: "gstin" | "phone", id: string, label: string): Promise<Res> {
  try {
    const { db, user } = await sessionEmail();
    if (!user) return { ok: false, error: "Please sign in again." };
    const { error } = await db.from(TABLES[kind]).update({ label: label.trim().slice(0, 80) || null }).eq("id", id);
    if (error) return { ok: false, error: "Could not rename that just now." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not rename that just now." };
  }
}
