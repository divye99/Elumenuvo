import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/** Live data for the buyer workspace (/app): the signed-in user's REAL
 *  projects and order-derived KPIs. Replaces the demo content for real
 *  accounts on the live site. */

export type LiveProject = { id: string; name: string; site: string | null; stage: string; created_at: string };
export type LiveOrder = { id: string; total: number; status: string; created_at: string; items: number };
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
    const { data } = await supabase
      .from("app_projects")
      .select("id, name, site, stage, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    projects = (data ?? []) as LiveProject[];
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
      orders = mine.map((o: any) => ({ id: o.id, total: Number(o.total ?? 0), status: o.status, created_at: o.created_at, items: Array.isArray(o.items) ? o.items.length : 0 }));
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
