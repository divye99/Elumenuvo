import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import { adminClient } from "@/lib/supabase/admin";
import OnboardingForm from "@/app/onboarding/OnboardingForm";

export const metadata = { robots: { index: false } };

export const dynamic = "force-dynamic";

/** Anything this person already told us at a checkout, so onboarding does not
 *  ask for it a second time. Best-effort: onboarding must render regardless. */
async function priorCheckoutDetails(email: string): Promise<{ phone: string; gstin: string }> {
  const db = adminClient();
  if (!db || !email) return { phone: "", gstin: "" };
  try {
    const { data } = await db
      .from("orders")
      .select("phone, gstin")
      .eq("email", email.trim().toLowerCase())
      .order("created_at", { ascending: false })
      .limit(5);
    // Any status counts, including an abandoned one: the details they typed
    // are just as valid whether or not the payment went through.
    return {
      phone: (data ?? []).find((o) => o.phone)?.phone ?? "",
      gstin: (data ?? []).find((o) => o.gstin)?.gstin ?? "",
    };
  } catch {
    return { phone: "", gstin: "" };
  }
}

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (profile.account_type) redirect("/app"); // already onboarded
  const prior = await priorCheckoutDetails(profile.email);
  return (
    <OnboardingForm
      defaultName={profile.full_name ?? profile.email.split("@")[0]}
      defaultPhone={prior.phone}
      defaultGstin={prior.gstin}
    />
  );
}
