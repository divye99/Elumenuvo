/**
 * Tenant resolution.
 *
 * PROTOTYPE NOTE: auth/login is not wired yet, so for the demo we resolve the
 * first seeded organisation ("Skyline Electricals"). When Supabase Auth is added,
 * this is the single place to swap in `createClient().auth.getUser()` →
 * membership lookup, and every page/query keeps working unchanged.
 */
import { db } from "@/lib/db";
import { organizations, memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function getCurrentOrg() {
  // Demo: the org the seeded demo user belongs to.
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      city: organizations.city,
      state: organizations.state,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(eq(memberships.userId, DEMO_USER_ID))
    .limit(1);

  if (!row) throw new Error("No organisation found — run `npm run db:seed`.");
  return row;
}

export async function getCurrentOrgId() {
  return (await getCurrentOrg()).id;
}
