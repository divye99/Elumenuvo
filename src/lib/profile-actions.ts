"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok: boolean; message: string } | null;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Save the signed-in user's profile (onboarding + account settings). */
export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const accountType = String(form.get("account_type") ?? "");
  if (accountType !== "business" && accountType !== "individual") return { ok: false, message: "Choose Business or Individual." };

  const fullName = String(form.get("full_name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const gstin = String(form.get("gstin") ?? "").trim().toUpperCase();
  const phone = String(form.get("phone") ?? "").trim();

  if (!fullName) return { ok: false, message: "Please enter your name." };
  if (accountType === "business") {
    if (!company) return { ok: false, message: "Please enter your company name." };
    if (!GSTIN_RE.test(gstin)) return { ok: false, message: "Enter a valid 15-character GSTIN." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    account_type: accountType,
    full_name: fullName,
    company: accountType === "business" ? company : null,
    gstin: accountType === "business" ? gstin : null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/app");
  revalidatePath("/catalogue");
  redirect("/app");
}
