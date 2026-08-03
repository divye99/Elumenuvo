import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { getSavedAddresses, type SavedAddress } from "@/lib/addresses";
import { getSavedGstins, getSavedPhones, type SavedGstin, type SavedPhone } from "@/lib/saved-fields";

/** Live data for the buyer workspace (/app): the signed-in user's REAL
 *  projects and order-derived KPIs. Replaces the demo content for real
 *  accounts on the live site. */

export type LiveProject = {
  id: string; name: string; site: string | null; stage: string; created_at: string;
  // Checkout-grade delivery details (migration 0076) - all optional so the
  // workspace renders fine for projects created before they existed.
  contact_name: string | null; contact_phone: string | null;
  address_line1: string | null; address_line2: string | null; address_line3: string | null;
  city: string | null; district: string | null; state: string | null; pin: string | null;
};
export type LiveShipment = {
  courier: string | null; awb: string | null; tracking_url: string | null;
  status: string; items: { name: string; qty: number }[];
  shipped_at: string | null; delivered_at: string | null; proof_url: string | null;
};
export type LiveEvent = { status: string; note: string | null; at: string };
export type LiveOrder = {
  id: string; total: number; status: string; created_at: string; items: number;
  // `id` is what makes one-tap reordering possible: the same SKUs go straight
  // back into the cart, re-priced server-side at checkout.
  lines: { id: string; name: string; qty: number; price: number }[];
  /** Structured billing/shipping, so "buy again" can restore the exact
   *  delivery setup instead of only the composed one-line string. */
  addressDetails: { billing?: Record<string, string>; shipping?: Record<string, string> } | null;
  // Everything the customer needs to trust the order without calling us:
  subtotal: number;               // taxable value (ex-GST)
  discount: number;               // 0 when no code applied
  discountCode: string | null;
  gstin: string | null;
  name: string | null; phone: string | null;
  shipping_address: string | null;
  payment_ref: string | null;     // Razorpay payment id
  paid_at: string | null;
  delivered_at: string | null;
  events: LiveEvent[];            // full status timeline, oldest first
  shipments: LiveShipment[];      // parcels with courier + AWB + proof
};
export type LiveWorkspace = {
  projects: LiveProject[];
  orders: LiveOrder[];
  /** Delivery/billing addresses, GST registrations and phone numbers banked
   *  from this account's checkouts, shown in Account settings so they can be
   *  reviewed, renamed, added to and removed. */
  addresses: SavedAddress[];
  gstins: SavedGstin[];
  phones: SavedPhone[];
  stats: {
    committed: number;        // sum of paid orders (this account's email/user)
    openCount: number;        // paid but not yet delivered
    openValue: number;
    deliveredCount: number;
  };
};

const REAL = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered"];

export async function getLiveWorkspace(userId: string, email: string | null): Promise<LiveWorkspace> {
  // Projects: the user's own rows via their session (RLS owner-scoped).
  let projects: LiveProject[] = [];
  try {
    const supabase = await createClient();
    // select * so the read works both before and after migration 0076 adds
    // the contact/address columns.
    const { data } = await supabase
      .from("app_projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    projects = (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id), name: String(r.name ?? ""), site: (r.site as string) ?? null,
      stage: String(r.stage ?? "Rough-in"), created_at: String(r.created_at ?? ""),
      contact_name: (r.contact_name as string) ?? null, contact_phone: (r.contact_phone as string) ?? null,
      address_line1: (r.address_line1 as string) ?? null, address_line2: (r.address_line2 as string) ?? null,
      address_line3: (r.address_line3 as string) ?? null,
      city: (r.city as string) ?? null, district: (r.district as string) ?? null,
      state: (r.state as string) ?? null, pin: (r.pin as string) ?? null,
    }));
  } catch { /* table not migrated yet: empty workspace still works */ }

  // Orders: matched by user id OR email (guest checkouts with the same email
  // belong to this person too). Orders have no user-read RLS, so this read is
  // server-side with the service role, scoped strictly to this identity.
  let orders: LiveOrder[] = [];
  const db = adminClient();
  if (db) {
    try {
      let q = db.from("orders").select("*").in("status", REAL).order("created_at", { ascending: false }).limit(200);
      const { data } = await q;
      const mine = (data ?? []).filter((o: any) => o.user_id === userId || (email && o.email && o.email.toLowerCase() === email.toLowerCase()));
      orders = mine.map((o: any) => ({
        id: o.id, total: Number(o.total ?? 0), status: o.status, created_at: o.created_at,
        items: Array.isArray(o.items) ? o.items.length : 0,
        lines: Array.isArray(o.items) ? o.items.slice(0, 20).map((i: any) => ({ id: String(i.id ?? ""), name: String(i.name ?? i.id ?? "item"), qty: Number(i.qty ?? 1), price: Number(i.price ?? 0) })) : [],
        addressDetails: (o.address_details ?? null) as LiveOrder["addressDetails"],
        subtotal: Number(o.subtotal ?? 0),
        discount: Number(o.discount_amount ?? 0),
        discountCode: o.discount_code ?? null,
        gstin: o.gstin ?? null,
        name: o.name ?? null, phone: o.phone ?? null,
        shipping_address: o.shipping_address ?? null,
        payment_ref: o.razorpay_payment_id ?? null,
        paid_at: o.paid_at ?? null,
        delivered_at: o.delivered_at ?? null,
        events: [], shipments: [],
      }));

      // Timeline + parcels for these orders, in two batched reads.
      const ids = orders.map((o) => o.id);
      if (ids.length) {
        try {
          const { data: evs } = await db.from("order_events").select("order_id, status, note, created_at").in("order_id", ids).order("created_at", { ascending: true }).limit(1000);
          const byOrder = new Map<string, LiveEvent[]>();
          for (const e of evs ?? []) {
            const list = byOrder.get(e.order_id) ?? [];
            list.push({ status: e.status, note: e.note ?? null, at: e.created_at });
            byOrder.set(e.order_id, list);
          }
          for (const o of orders) o.events = byOrder.get(o.id) ?? [];
        } catch { /* timeline table absent: dropdown still renders */ }
        try {
          const { data: shp } = await db.from("order_shipments").select("*").in("order_id", ids).order("created_at", { ascending: true }).limit(500);
          const byOrder = new Map<string, LiveShipment[]>();
          for (const s of shp ?? []) {
            const list = byOrder.get(s.order_id) ?? [];
            list.push({
              courier: s.courier ?? null, awb: s.awb ?? null, tracking_url: s.tracking_url ?? null,
              status: s.status ?? "packed",
              items: Array.isArray(s.items) ? s.items.map((i: any) => ({ name: String(i.name ?? i.id ?? "item"), qty: Number(i.qty ?? 1) })) : [],
              shipped_at: s.shipped_at ?? null, delivered_at: s.delivered_at ?? null, proof_url: s.proof_url ?? null,
            });
            byOrder.set(s.order_id, list);
          }
          for (const o of orders) o.shipments = byOrder.get(o.id) ?? [];
        } catch { /* parcels table absent: dropdown still renders */ }
      }
    } catch { /* keep zeros */ }
  }

  const open = orders.filter((o) => o.status !== "delivered");
  return {
    projects,
    orders,
    addresses: email ? await getSavedAddresses(email) : [],
    gstins: email ? await getSavedGstins(email) : [],
    phones: email ? await getSavedPhones(email) : [],
    stats: {
      committed: orders.reduce((s, o) => s + o.total, 0),
      openCount: open.length,
      openValue: open.reduce((s, o) => s + o.total, 0),
      deliveredCount: orders.length - open.length,
    },
  };
}
