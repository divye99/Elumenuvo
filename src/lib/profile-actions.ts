"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { ok: boolean; message: string } | null;

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export type BusinessResult = { ok: true } | { ok: false; message: string; needsConfirmation?: boolean };

/**
 * Write a business profile for the signed-in user (used by the /business
 * "open a business account" form, right after sign-up or for an upgrade).
 * If Supabase requires email confirmation there is no session yet, so we say
 * so rather than failing silently.
 */
export async function saveBusinessProfile(input: {
  company: string; gstin: string; business_type: string;
  first_name: string; last_name: string; phone: string;
}): Promise<BusinessResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Confirm your email, then sign in to finish setting up.", needsConfirmation: true };

  const company = input.company.trim();
  const gstin = input.gstin.trim().toUpperCase();
  const first = input.first_name.trim();
  const last = input.last_name.trim();
  if (!company) return { ok: false, message: "Please enter your company name." };
  if (!GSTIN_RE.test(gstin)) return { ok: false, message: "Enter a valid 15-character GSTIN." };
  if (!first || !last) return { ok: false, message: "Please enter the contact person's first and last name." };

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    account_type: "business",
    first_name: first,
    last_name: last,
    full_name: `${first} ${last}`,
    company,
    gstin,
    business_type: input.business_type || null,
    phone: input.phone.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/app");
  revalidatePath("/checkout");
  return { ok: true };
}

/** Save the signed-in user's profile (onboarding + account settings). */
export async function saveProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const accountType = String(form.get("account_type") ?? "");
  if (accountType !== "business" && accountType !== "individual") return { ok: false, message: "Choose Business or Individual." };

  const firstName = String(form.get("first_name") ?? "").trim();
  const lastName = String(form.get("last_name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const gstin = String(form.get("gstin") ?? "").trim().toUpperCase();
  const businessType = String(form.get("business_type") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  if (!firstName || !lastName) return { ok: false, message: "Please enter your first and last name." };
  if (accountType === "business") {
    if (!company) return { ok: false, message: "Please enter your company name." };
    if (!GSTIN_RE.test(gstin)) return { ok: false, message: "Enter a valid 15-character GSTIN." };
  }

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    account_type: accountType,
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`, // composed display name
    company: accountType === "business" ? company : null,
    gstin: accountType === "business" ? gstin : null,
    business_type: accountType === "business" ? (businessType || null) : null,
    phone: phone || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/app");
  revalidatePath("/catalogue");
  redirect("/app");
}

export type WsProfileResult = { ok: true } | { ok: false; error: string };

/** Personal details edit from the workspace account screen (name + phone). */
export async function updatePersonalDetails(fullName: string, phone: string): Promise<WsProfileResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    const name = fullName.trim().slice(0, 120);
    if (!name) return { ok: false, error: "Please enter your name." };
    const parts = name.split(/\s+/);
    const { error } = await supabase.from("profiles").update({
      full_name: name,
      first_name: parts[0],
      last_name: parts.slice(1).join(" ") || null,
      phone: phone.trim().slice(0, 20) || null,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save your details." };
  }
}

/** Switch an individual account to business (or edit business fields). */
export async function upgradeToBusiness(company: string, gstin: string): Promise<WsProfileResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    const co = company.trim().slice(0, 160);
    if (!co) return { ok: false, error: "Please enter your company name." };
    const gst = gstin.trim().toUpperCase();
    if (!GSTIN_RE.test(gst)) return { ok: false, error: "Enter a valid 15-character GSTIN (e.g. 07AABCU9603R1ZM)." };
    const { error } = await supabase.from("profiles").update({
      account_type: "business",
      company: co,
      gstin: gst,
      updated_at: new Date().toISOString(),
    }).eq("id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not switch the account." };
  }
}
