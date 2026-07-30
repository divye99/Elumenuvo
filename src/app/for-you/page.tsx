import type { Metadata } from "next";
import { redirect } from "next/navigation";
import StoreChrome from "@/components/storefront/StoreChrome";
import ForYouClient from "./ForYouClient";
import { getProfile } from "@/lib/profile";
import { buildForYou } from "@/lib/for-you";

/**
 * The personalized "For you" page - the customer's own catalogue, assembled
 * from their orders, views, searches and our editorial ranks. Per-user and
 * signed-in only, so it renders dynamically (no ISR).
 *
 * Desktop: Brands you love strip up top, then Previously ordered (left) and
 * Previously viewed (right) side by side, then a full-width Recommended rail.
 * Mobile: the same sections stacked. Every section has a "See all".
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For you",
  robots: { index: false, follow: false }, // personal page, never indexed
};

export default async function ForYouPage() {
  const profile = await getProfile();
  if (!profile?.email) redirect("/signin?next=/for-you");

  const data = await buildForYou(profile.email);
  return (
    <StoreChrome>
      <ForYouClient data={data} firstName={(profile.full_name ?? "").split(" ")[0] || null} />
    </StoreChrome>
  );
}
