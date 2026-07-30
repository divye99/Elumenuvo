import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

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
export type LiveOrder = { id: string; total: number; status: string; created_at: string; items: number; lines: { name: string; qty: number }[] };
export type LiveWorkspace = {
  projects: LiveProject[];
  orders: LiveOrder[];
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
      let q = db.from("orders").select("id, total, status, created_at, items, user_id, email").in("status", REAL).order("created_at", { ascending: false }).limit(200);
      const { data } = await q;
      const mine = (data ?? []).filter((o: any) => o.user_id === userId || (email && o.email && o.email.toLowerCase() === email.toLowerCase()));
      orders = mine.map((o: any) => ({
        id: o.id, total: Number(o.total ?? 0), status: o.status, created_at: o.created_at,
        items: Array.isArray(o.items) ? o.items.length : 0,
        lines: Array.isArray(o.items) ? o.items.slice(0, 12).map((i: any) => ({ name: String(i.name ?? i.id ?? "item"), qty: Number(i.qty ?? 1) })) : [],
      }));
    } catch { /* keep zeros */ }
  }

  const open = orders.filter((o) => o.status !== "delivered");
  return {
    projects,
    orders,
    stats: {
      committed: orders.reduce((s, o) => s + o.total, 0),
      openCount: open.length,
      openValue: open.reduce((s, o) => s + o.total, 0),
      deliveredCount: orders.length - open.length,
    },
  };
}
