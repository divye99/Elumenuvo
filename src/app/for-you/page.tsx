import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import ForYouClient from "./ForYouClient";
import PersonalRails from "@/components/storefront/PersonalRails";
import { getProfile } from "@/lib/profile";
import { buildForYou } from "@/lib/for-you";

/**
 * The personalized "For you" page - the visitor's own catalogue.
 *
 * Signed-in customers get the account view (Brands you love, Previously
 * ordered/viewed, Recommended) PLUS the engine rails (Due for a reorder,
 * More like what you viewed, Picked for you).
 *
 * Guests are welcome too: no sign-in wall. Their device's browsing history
 * powers the engine rails client-side, and the page keeps sharpening as
 * they browse - the Netflix pattern, not a login gate.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "For you",
  robots: { index: false, follow: false }, // personal page, never indexed
};

export default async function ForYouPage() {
  const profile = await getProfile();

  if (!profile?.email) {
    return (
      <StoreChrome>
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 24px 70px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 4px" }}>For you</h1>
          <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 24px" }}>
            Built from what you browse - it sharpens every visit. Sign in and your orders join in:
            reorder reminders, your brands, your prices.
          </p>
          <PersonalRails ctx="foryou" />
        </main>
      </StoreChrome>
    );
  }

  const data = await buildForYou(profile.email);
  return (
    <StoreChrome>
      <ForYouClient data={data} firstName={(profile.full_name ?? "").split(" ")[0] || null} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "10px 24px 60px" }}>
        <PersonalRails ctx="foryou" />
      </div>
    </StoreChrome>
  );
}
