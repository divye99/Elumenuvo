/**
 * Dashboard data access — the multi-site procurement rollup from the docs:
 * committed spend, outstanding deliveries, credit utilisation, budget variance.
 * All tenant-scoped by organizationId.
 */
import { db } from "@/lib/db";
import {
  projects,
  purchaseOrders,
  deliveries,
  creditProfiles,
} from "@/lib/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

export type ProjectRollup = {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  stage: string | null;
  status: string;
  budget: number;
  committed: number;
  variancePct: number; // committed / budget
  openDeliveries: number;
  poCount: number;
};

export async function getProjectRollups(orgId: string): Promise<ProjectRollup[]> {
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      location: projects.location,
      city: projects.city,
      stage: projects.stage,
      status: projects.status,
      budget: projects.budgetAmount,
      committed: sql<string>`coalesce(sum(${purchaseOrders.totalAmount}), 0)`,
      poCount: sql<number>`count(distinct ${purchaseOrders.id})`,
    })
    .from(projects)
    .leftJoin(
      purchaseOrders,
      and(
        eq(purchaseOrders.projectId, projects.id),
        ne(purchaseOrders.status, "cancelled")
      )
    )
    .where(eq(projects.organizationId, orgId))
    .groupBy(projects.id)
    .orderBy(projects.createdAt);

  // Open deliveries per project (not yet delivered).
  const openDel = await db
    .select({
      projectId: purchaseOrders.projectId,
      open: sql<number>`count(*)`,
    })
    .from(deliveries)
    .innerJoin(purchaseOrders, eq(deliveries.purchaseOrderId, purchaseOrders.id))
    .where(
      and(eq(purchaseOrders.organizationId, orgId), ne(deliveries.status, "delivered"))
    )
    .groupBy(purchaseOrders.projectId);
  const openMap = new Map(openDel.map((d) => [d.projectId, Number(d.open)]));

  return rows.map((r) => {
    const budget = Number(r.budget ?? 0);
    const committed = Number(r.committed);
    return {
      id: r.id,
      name: r.name,
      location: r.location,
      city: r.city,
      stage: r.stage,
      status: r.status,
      budget,
      committed,
      variancePct: budget > 0 ? (committed / budget) * 100 : 0,
      openDeliveries: openMap.get(r.id) ?? 0,
      poCount: Number(r.poCount),
    };
  });
}

export type PortfolioSummary = {
  activeProjects: number;
  totalBudget: number;
  totalCommitted: number;
  openDeliveries: number;
  creditLimit: number;
  creditUtilised: number;
  creditScore: number | null;
  nbfcPartner: string | null;
};

export async function getPortfolioSummary(orgId: string): Promise<PortfolioSummary> {
  const rollups = await getProjectRollups(orgId);
  const [credit] = await db
    .select()
    .from(creditProfiles)
    .where(eq(creditProfiles.organizationId, orgId))
    .limit(1);

  return {
    activeProjects: rollups.filter((r) => r.status === "active").length,
    totalBudget: rollups.reduce((s, r) => s + r.budget, 0),
    totalCommitted: rollups.reduce((s, r) => s + r.committed, 0),
    openDeliveries: rollups.reduce((s, r) => s + r.openDeliveries, 0),
    creditLimit: Number(credit?.approvedLimit ?? 0),
    creditUtilised: Number(credit?.utilisedAmount ?? 0),
    creditScore: credit?.creditScore ?? null,
    nbfcPartner: credit?.nbfcPartner ?? null,
  };
}
