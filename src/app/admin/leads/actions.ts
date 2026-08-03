"use server";

import { isAdmin } from "@/lib/admin/auth";
import { sendBusinessAccountNudge } from "@/lib/email";

/** Send one business-account nudge. Admin-only, and one recipient per call:
 *  this is a deliberate per-row action in the console, never a bulk blast. */
export async function nudgeBusinessAccount(input: {
  email: string; name?: string | null; gstin: string; orders: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  if (!/^\S+@\S+\.\S+$/.test(input.email ?? "")) return { ok: false, error: "No usable email." };
  const res = await sendBusinessAccountNudge(input);
  if (res.skipped) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };
  return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Send failed." };
}
