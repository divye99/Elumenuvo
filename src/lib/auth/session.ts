/**
 * Tenant resolution.
 *
 * Resolution order:
 *   1. (future) authenticated Supabase user → their membership org
 *   2. signed sandbox cookie → that per-visitor sandbox org
 *   3. none → redirect to the marketing landing ("/")
 *
 * Every page/query takes an `orgId`, so they all keep working regardless of how
 * the tenant is resolved. When real auth lands, add step 1 here only.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { SANDBOX_COOKIE, readSandboxToken } from "@/lib/sandbox/cookie";

export type CurrentOrg = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  state: string | null;
  isSandbox: boolean;
  expiresAt: Date | null;
};

/** Resolves the current org, or null if there's no valid sandbox/session. */
export async function resolveCurrentOrg(): Promise<CurrentOrg | null> {
  const token = (await cookies()).get(SANDBOX_COOKIE)?.value;
  const orgId = readSandboxToken(token);
  if (!orgId) return null;

  const [org] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      type: organizations.type,
      city: organizations.city,
      state: organizations.state,
      isSandbox: organizations.isSandbox,
      expiresAt: organizations.expiresAt,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  // Cookie may point at a reaped sandbox — treat as no session.
  return org ?? null;
}

/** Like resolveCurrentOrg but redirects to the landing if there's no session. */
export async function getCurrentOrg(): Promise<CurrentOrg> {
  const org = await resolveCurrentOrg();
  if (!org) redirect("/");
  return org;
}

export async function getCurrentOrgId(): Promise<string> {
  return (await getCurrentOrg()).id;
}
