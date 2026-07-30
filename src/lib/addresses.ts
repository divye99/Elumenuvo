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
  // How this address has actually been used - drives which checkout picker
  // offers it (developers bill to the office, ship to sites).
  usedBilling: boolean;
  usedShipping: boolean;
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
      // Pre-0077 rows have no flags: they came from the delivery address.
      usedBilling: r.used_billing === true,
      usedShipping: r.used_shipping !== false,
    }));
  } catch {
    return []; // table not migrated yet: checkout still works, just without the picker
  }
}

function cleanAddress(s: Partial<StructuredAddress> | undefined | null): StructuredAddress | null {
  if (!s?.line1?.trim()) return null;
  return {
    line1: s.line1 ?? "", line2: s.line2 ?? "", line3: s.line3 ?? "",
    city: s.city ?? "", district: s.district ?? "", state: s.state ?? "",
    pin: s.pin ?? "", country: s.country || "India",
  };
}

/**
 * Save the addresses of a paid order into saved_addresses - billing and
 * shipping SEPARATELY, each flagged with how it was used (an identical pair
 * becomes one row flagged as both). Flags only ever turn on: an address that
 * was once a billing address stays offered as one.
 * Best-effort by design: called from markOrderPaid, and a failure here must
 * never block a payment from being recorded.
 */
export async function saveAddressFromOrder(
  db: NonNullable<ReturnType<typeof adminClient>>,
  order: {
    email: string; name?: string | null; phone?: string | null;
    user_id?: string | null;
    address_details?: { billing?: Partial<StructuredAddress>; shipping?: Partial<StructuredAddress> } | null;
  }
): Promise<void> {
  const shipping = cleanAddress(order.address_details?.shipping);
  const billing = cleanAddress(order.address_details?.billing);
  if (!shipping && !billing) return; // legacy orders have no structured address

  const phone = (order.phone ?? "").trim();
  const email = order.email.trim().toLowerCase();

  // Collapse an identical billing/shipping pair into one entry with both flags.
  const entries: { addr: StructuredAddress; usedBilling: boolean; usedShipping: boolean }[] = [];
  if (shipping) entries.push({ addr: shipping, usedBilling: false, usedShipping: true });
  if (billing) {
    const same = shipping && addressFingerprint(billing, phone) === addressFingerprint(shipping, phone);
    if (same) entries[0].usedBilling = true;
    else entries.push({ addr: billing, usedBilling: true, usedShipping: false });
  }

  for (const e of entries) {
    const fp = addressFingerprint(e.addr, phone);
    const base = {
      email,
      user_id: order.user_id ?? null,
      contact_name: (order.name ?? "").trim() || null,
      phone: phone || null,
      address_line1: e.addr.line1.trim(), address_line2: e.addr.line2.trim() || null, address_line3: e.addr.line3.trim() || null,
      city: e.addr.city.trim() || null, district: e.addr.district.trim() || null,
      state: e.addr.state || null, pin: e.addr.pin.trim() || null, country: e.addr.country,
      fingerprint: fp,
      last_used_at: new Date().toISOString(),
    };
    try {
      // Read-then-write so the usage flags accumulate (an upsert would clobber
      // used_billing=true when the same address later ships an order).
      const { data: existing } = await db
        .from("saved_addresses").select("id, used_billing, used_shipping")
        .eq("email", email).eq("fingerprint", fp).maybeSingle();
      if (existing) {
        const { error } = await db.from("saved_addresses").update({
          ...base,
          used_billing: existing.used_billing === true || e.usedBilling,
          used_shipping: existing.used_shipping === true || e.usedShipping,
        }).eq("id", existing.id);
        // Pre-0077 schema: retry without the flag columns.
        if (error && /used_billing|used_shipping/.test(error.message)) {
          await db.from("saved_addresses").update(base).eq("id", existing.id);
        }
      } else {
        const { error } = await db.from("saved_addresses").insert({
          ...base, used_billing: e.usedBilling, used_shipping: e.usedShipping,
        });
        // Pre-0077 schema: retry without the flag columns.
        if (error && /used_billing|used_shipping/.test(error.message)) {
          await db.from("saved_addresses").insert(base);
        }
      }
    } catch { /* table not migrated yet, or transient - never blocks payment */ }
  }
}
