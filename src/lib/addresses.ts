import { adminClient } from "@/lib/supabase/admin";

/**
 * Saved delivery addresses - captured automatically the moment an order is
 * PAID (never for abandoned checkouts), keyed by email so guest orders attach
 * to the account that later signs up with the same email. Deduped by a
 * normalized fingerprint, so ordering twice to the same site just bumps
 * last_used_at instead of stacking duplicates.
 */
export type StructuredAddress = {
  line1: string; line2: string; line3: string;
  city: string; district: string; state: string; pin: string; country: string;
};

export type SavedAddress = StructuredAddress & {
  id: string;
  contact_name: string;
  phone: string; // E.164
};

/** Normalized identity of an address+phone: case/spacing/punctuation-proof. */
export function addressFingerprint(a: StructuredAddress, phone: string): string {
  const flat = [a.line1, a.line2, a.line3, a.city, a.district, a.state, a.pin, phone]
    .map((s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""))
    .join("|");
  return flat;
}

/** The saved addresses for an email, most recently used first. */
export async function getSavedAddresses(email: string): Promise<SavedAddress[]> {
  const db = adminClient();
  if (!db || !email) return [];
  try {
    const { data } = await db
      .from("saved_addresses")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .order("last_used_at", { ascending: false })
      .limit(12);
    return (data ?? []).map((r) => ({
      id: r.id,
      contact_name: r.contact_name ?? "",
      phone: r.phone ?? "",
      line1: r.address_line1 ?? "", line2: r.address_line2 ?? "", line3: r.address_line3 ?? "",
      city: r.city ?? "", district: r.district ?? "", state: r.state ?? "", pin: r.pin ?? "",
      country: r.country ?? "India",
    }));
  } catch {
    return []; // table not migrated yet: checkout still works, just without the picker
  }
}

/**
 * Upsert the delivery address of a paid order into saved_addresses.
 * Best-effort by design: called from markOrderPaid, and a failure here must
 * never block a payment from being recorded.
 */
export async function saveAddressFromOrder(
  db: NonNullable<ReturnType<typeof adminClient>>,
  order: {
    email: string; name?: string | null; phone?: string | null;
    user_id?: string | null; address_details?: { shipping?: Partial<StructuredAddress> } | null;
  }
): Promise<void> {
  const s = order.address_details?.shipping;
  if (!s?.line1?.trim()) return; // legacy orders have no structured address
  const addr: StructuredAddress = {
    line1: s.line1 ?? "", line2: s.line2 ?? "", line3: s.line3 ?? "",
    city: s.city ?? "", district: s.district ?? "", state: s.state ?? "",
    pin: s.pin ?? "", country: s.country || "India",
  };
  const phone = (order.phone ?? "").trim();
  const email = order.email.trim().toLowerCase();
  const fp = addressFingerprint(addr, phone);
  try {
    await db.from("saved_addresses").upsert(
      {
        email,
        user_id: order.user_id ?? null,
        contact_name: (order.name ?? "").trim() || null,
        phone: phone || null,
        address_line1: addr.line1.trim(), address_line2: addr.line2.trim() || null, address_line3: addr.line3.trim() || null,
        city: addr.city.trim() || null, district: addr.district.trim() || null,
        state: addr.state || null, pin: addr.pin.trim() || null, country: addr.country,
        fingerprint: fp,
        last_used_at: new Date().toISOString(),
      },
      { onConflict: "email,fingerprint" }
    );
  } catch { /* table not migrated yet, or transient - never blocks payment */ }
}
