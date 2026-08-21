import type { SavedEntry } from "@/app/checkout/CheckoutClient";
import { getSavedAddresses } from "@/lib/addresses";
import { createClient } from "@/lib/supabase/server";

/** One-line summary used on the saved-entry cards. */
function addrLine(a: { line1?: string | null; city?: string | null; state?: string | null; pin?: string | null }): string {
  return [a.line1, a.city, [a.state, a.pin].filter(Boolean).join(" - ")].map((s) => (s ?? "").trim()).filter(Boolean).join(", ");
}

/** Workspace projects (with a delivery address) + auto-saved addresses, as
 *  one-tap checkout choices. Projects lead - they are deliberate setups.
 *  Shared by /checkout and the custom-order page /order/<token>. */
export async function savedEntries(email: string): Promise<SavedEntry[]> {
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
        usedShipping: true,
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
      usedBilling: a.usedBilling, usedShipping: a.usedShipping,
    });
  }
  return entries.slice(0, 14);
}
