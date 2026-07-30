import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CheckoutClient, { type SavedEntry } from "@/app/checkout/CheckoutClient";
import { getProfile } from "@/lib/profile";
import { onlinePaymentAvailable } from "@/lib/order-actions";
import { getSavedAddresses } from "@/lib/addresses";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/** One-line summary used on the saved-entry cards. */
function addrLine(a: { line1?: string | null; city?: string | null; state?: string | null; pin?: string | null }): string {
  return [a.line1, a.city, [a.state, a.pin].filter(Boolean).join(" - ")].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
}

/** Workspace projects (with a delivery address) + auto-saved addresses, as
 *  one-tap checkout choices. Projects lead - they are deliberate setups. */
async function savedEntries(email: string): Promise<SavedEntry[]> {
  const entries: SavedEntry[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_projects").select("*").order("created_at", { ascending: false }).limit(50);
    for (const r of data ?? []) {
      if (!r.address_line1) continue; // only projects with a full delivery setup
      entries.push({
        kind: "project", id: `pr-${r.id}`, label: r.name, sub: addrLine({ line1: r.address_line1, city: r.city, state: r.state, pin: r.pin }),
        contact_name: r.contact_name ?? "", phone: r.contact_phone ?? "",
        line1: r.address_line1 ?? "", line2: r.address_line2 ?? "", line3: r.address_line3 ?? "",
        city: r.city ?? "", district: r.district ?? "", state: r.state ?? "", pin: r.pin ?? "", country: "India",
      });
    }
  } catch { /* pre-migration: no picker */ }
  const addresses = await getSavedAddresses(email);
  for (const a of addresses) {
    entries.push({
      kind: "address", id: `ad-${a.id}`, label: a.line1, sub: addrLine(a),
      contact_name: a.contact_name, phone: a.phone,
      line1: a.line1, line2: a.line2, line3: a.line3,
      city: a.city, district: a.district, state: a.state, pin: a.pin, country: a.country,
    });
  }
  return entries.slice(0, 10);
}

export default async function CheckoutPage() {
  // prefill for signed-in users; guests get a blank form
  const [profile, onlineEnabled] = await Promise.all([getProfile(), onlinePaymentAvailable()]);
  const saved = profile?.email ? await savedEntries(profile.email) : [];
  return (
    <StoreChrome>
      <CheckoutClient
        onlineEnabled={onlineEnabled}
        saved={saved}
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
