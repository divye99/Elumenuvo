import { createClient } from "@/lib/supabase/server";

export type AccountType = "business" | "individual";
export type Profile = {
  id: string;
  email: string;
  account_type: AccountType | null;
  full_name: string | null;
  company: string | null;
  gstin: string | null;
  phone: string | null;
};

/** The signed-in user's profile (or null if not signed in). */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    account_type: (data?.account_type as AccountType) ?? null,
    full_name: data?.full_name ?? null,
    company: data?.company ?? null,
    gstin: data?.gstin ?? null,
    phone: data?.phone ?? null,
  };
}

/** A business profile is one that has chosen the business account type. */
export function isBusiness(p: Profile | null): boolean {
  return p?.account_type === "business";
}
