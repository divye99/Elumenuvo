import { redirect } from "next/navigation";
import { getProfile, isBusiness } from "@/lib/profile";
import BoqAssistant from "@/components/app/BoqAssistant";

/** Smart BOM - the BOQ assistant (business accounts only, owner moat).
 *  The gate is enforced here AND in both API routes; this page is just the
 *  friendly front door. Personal accounts get routed to the upgrade flow. */
export const dynamic = "force-dynamic";

export default async function BoqPage() {
  const profile = await getProfile();
  if (!profile) redirect("/signin?next=/app/boq");
  if (!isBusiness(profile)) redirect("/business?from=boq");
  return <BoqAssistant company={profile.company ?? undefined} />;
}
