import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CheckoutClient from "@/app/checkout/CheckoutClient";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const profile = await getProfile(); // prefill for signed-in users; guests get a blank form
  return (
    <StoreChrome>
      <CheckoutClient
        prefill={{
          name: profile?.full_name ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
          gstin: profile?.gstin ?? "",
          isBusiness: profile?.account_type === "business",
          signedIn: !!profile,
        }}
      />
    </StoreChrome>
  );
}
