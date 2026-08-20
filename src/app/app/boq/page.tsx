import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile, isBusiness, hasPurchases } from "@/lib/profile";
import { isAdmin } from "@/lib/admin/auth";
import BoqAssistant from "@/components/app/BoqAssistant";

/** Smart BOM - the BOQ assistant. Owner gate (Aug 2026): business accounts
 *  WITH a record of purchase only - not public, not zero-order businesses.
 *  Enforced here AND in the match API; this page is the friendly front door.
 *  The owner's own way in is the admin console: an admin cookie routes to
 *  /admin/boq instead of bouncing off the business gate. */
export const dynamic = "force-dynamic";

export default async function BoqPage() {
  if (await isAdmin()) redirect("/admin/boq");
  const profile = await getProfile();
  if (!profile) redirect("/signin?next=/app/boq");
  if (!isBusiness(profile)) redirect("/business?from=boq");
  if (!(await hasPurchases(profile.email))) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 10px" }}>Smart BOM unlocks after your first order</h1>
        <p style={{ fontSize: 14.5, color: "#56627A", lineHeight: 1.65, margin: "0 0 18px" }}>
          Smart BOM turns a pasted BOQ into a priced, ready-to-order cart. It is in early access for
          business customers who have ordered with us before. Place your first order and it unlocks
          automatically.
        </p>
        <Link href="/catalogue" style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontSize: 14, fontWeight: 700, padding: "10px 20px", borderRadius: 8 }}>
          Browse the catalogue
        </Link>
      </main>
    );
  }
  return <BoqAssistant company={profile.company ?? undefined} />;
}
