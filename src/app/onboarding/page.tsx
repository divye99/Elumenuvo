import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";
import OnboardingForm from "@/app/onboarding/OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (profile.account_type) redirect("/app"); // already onboarded
  return <OnboardingForm defaultName={profile.full_name ?? profile.email.split("@")[0]} />;
}
