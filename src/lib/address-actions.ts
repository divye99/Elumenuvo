"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Remove a saved address from the account's address book.
 *
 * Deliberately runs on the USER's session, not the service role: the RLS
 * policy on saved_addresses ("own addresses delete") is what guarantees a
 * signed-in person can only ever delete their own rows, so the check lives in
 * one place rather than being re-implemented here.
 */
export async function deleteSavedAddress(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!id) return { ok: false, error: "No address given." };
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    const { error } = await db.from("saved_addresses").delete().eq("id", id);
    if (error) return { ok: false, error: "Could not remove that address just now." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not remove that address just now." };
  }
}
