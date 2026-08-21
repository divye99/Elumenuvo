import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CheckoutClient, { type SavedEntry } from "@/app/checkout/CheckoutClient";
import { getProfile } from "@/lib/profile";
import { onlinePaymentAvailable } from "@/lib/order-actions";
import { getSavedGstins, getSavedPhones, PHONE_SOURCE_LABEL } from "@/lib/saved-fields";
import { savedEntries } from "@/lib/checkout-prefill";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  // prefill for signed-in users; guests get a blank form
  const [profile, onlineEnabled] = await Promise.all([getProfile(), onlinePaymentAvailable()]);
  const email = profile?.email ?? "";
  // Three independent pick-lists: an enterprise can hold several GST
  // registrations, and the site number is rarely the accounts number.
  const [saved, gstins, phones] = await Promise.all([
    email ? savedEntries(email) : Promise.resolve([]),
    email ? getSavedGstins(email) : Promise.resolve([]),
    email ? getSavedPhones(email) : Promise.resolve([]),
  ]);
  return (
    <StoreChrome>
      <CheckoutClient
        onlineEnabled={onlineEnabled}
        saved={saved}
        savedGstins={gstins.map((g) => ({ id: g.id, value: g.gstin, label: g.label || g.state }))}
        savedPhones={phones.map((p) => ({ id: p.id, value: p.phone, label: p.label || PHONE_SOURCE_LABEL[p.source] || "" }))}
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
