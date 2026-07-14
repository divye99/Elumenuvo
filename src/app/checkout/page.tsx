import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CheckoutClient from "@/app/checkout/CheckoutClient";
import { getProfile } from "@/lib/profile";
import { onlinePaymentAvailable } from "@/lib/order-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  // prefill for signed-in users; guests get a blank form
  const [profile, onlineEnabled] = await Promise.all([getProfile(), onlinePaymentAvailable()]);
  return (
    <StoreChrome>
      <CheckoutClient
        onlineEnabled={onlineEnabled}
        prefill={{
          name: profile?.full_name ?? "",
          email: profile?.email ?? "",
          phone: profile?.phone ?? "",
          gstin: profile?.gstin ?? "",
          company: profile?.company ?? "",
          isBusiness: profile?.account_type === "business",
          signedIn: !!profile,
        }}
      />
    </StoreChrome>
  );
}
