/**
 * Sandbox provisioning — clones the seeded template org into a fresh, isolated
 * per-visitor workspace. Catalogue (brands/categories/products/prices) is shared,
 * so only tenant rows are cloned (a few dozen) — fast and cheap.
 *
 * Reaping rides the existing `onDelete: cascade` chain: deleting the org wipes
 * all of its child rows automatically.
 */
import { randomUUID } from "crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  projects,
  boms,
  bomItems,
  creditProfiles,
  purchaseOrders,
  poItems,
  deliveries,
  invoices,
} from "@/lib/db/schema";
import { SANDBOX_TTL_MS } from "@/lib/sandbox/cookie";

/**
 * Creates a new sandbox org cloned from the template. Returns { orgId, expiresAt }.
 */
export async function provisionSandbox(): Promise<{ orgId: string; expiresAt: Date }> {
  const [template] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.isTemplate, true))
    .limit(1);
  if (!template) {
    throw new Error("No template org found — run `npm run db:seed`.");
  }

  const newOrgId = randomUUID();
  const suffix = newOrgId.slice(0, 8);
  const expiresAt = new Date(Date.now() + SANDBOX_TTL_MS);

  // Pre-fetch all template tenant rows.
  const [tProjects, tCredit] = await Promise.all([
    db.select().from(projects).where(eq(projects.organizationId, template.id)),
    db.select().from(creditProfiles).where(eq(creditProfiles.organizationId, template.id)),
  ]);
  const projectIds = tProjects.map((p) => p.id);

  const tBoms = projectIds.length
    ? await db.select().from(boms).where(inArray(boms.projectId, projectIds))
    : [];
  const bomIds = tBoms.map((b) => b.id);
  const tBomItems = bomIds.length
    ? await db.select().from(bomItems).where(inArray(bomItems.bomId, bomIds))
    : [];

  const tPOs = projectIds.length
    ? await db.select().from(purchaseOrders).where(inArray(purchaseOrders.projectId, projectIds))
    : [];
  const poIds = tPOs.map((p) => p.id);
  const tPoItems = poIds.length
    ? await db.select().from(poItems).where(inArray(poItems.purchaseOrderId, poIds))
    : [];
  const tDeliveries = poIds.length
    ? await db.select().from(deliveries).where(inArray(deliveries.purchaseOrderId, poIds))
    : [];
  const tInvoices = poIds.length
    ? await db.select().from(invoices).where(inArray(invoices.purchaseOrderId, poIds))
    : [];

  // id remapping
  const projMap = new Map(projectIds.map((id) => [id, randomUUID()]));
  const bomMap = new Map(bomIds.map((id) => [id, randomUUID()]));
  const poMap = new Map(poIds.map((id) => [id, randomUUID()]));

  await db.transaction(async (tx) => {
    await tx.insert(organizations).values({
      id: newOrgId,
      name: `${template.name} (Demo)`,
      slug: `${template.slug}-demo-${suffix}`,
      type: template.type,
      gstin: template.gstin,
      city: template.city,
      state: template.state,
      addressLine: template.addressLine,
      isSandbox: true,
      templateOrgId: template.id,
      expiresAt,
    });

    for (const c of tCredit) {
      await tx.insert(creditProfiles).values({
        ...c,
        id: randomUUID(),
        organizationId: newOrgId,
      });
    }

    for (const p of tProjects) {
      await tx.insert(projects).values({
        ...p,
        id: projMap.get(p.id)!,
        organizationId: newOrgId,
      });
    }

    for (const b of tBoms) {
      await tx.insert(boms).values({
        ...b,
        id: bomMap.get(b.id)!,
        organizationId: newOrgId,
        projectId: projMap.get(b.projectId)!,
      });
    }

    for (const it of tBomItems) {
      await tx.insert(bomItems).values({
        ...it,
        id: randomUUID(),
        organizationId: newOrgId,
        bomId: bomMap.get(it.bomId)!,
      });
    }

    for (const po of tPOs) {
      await tx.insert(purchaseOrders).values({
        ...po,
        id: poMap.get(po.id)!,
        organizationId: newOrgId,
        projectId: po.projectId ? projMap.get(po.projectId) ?? null : null,
        bomId: po.bomId ? bomMap.get(po.bomId) ?? null : null,
        poNumber: `${po.poNumber}-${suffix}`,
      });
    }

    for (const it of tPoItems) {
      await tx.insert(poItems).values({
        ...it,
        id: randomUUID(),
        organizationId: newOrgId,
        purchaseOrderId: poMap.get(it.purchaseOrderId)!,
      });
    }

    for (const d of tDeliveries) {
      await tx.insert(deliveries).values({
        ...d,
        id: randomUUID(),
        organizationId: newOrgId,
        purchaseOrderId: poMap.get(d.purchaseOrderId)!,
      });
    }

    for (const inv of tInvoices) {
      await tx.insert(invoices).values({
        ...inv,
        id: randomUUID(),
        organizationId: newOrgId,
        purchaseOrderId: poMap.get(inv.purchaseOrderId)!,
        invoiceNumber: `${inv.invoiceNumber}-${suffix}`,
      });
    }
  });

  return { orgId: newOrgId, expiresAt };
}

/** Deletes a sandbox org (cascade wipes its data) — used by "Reset workspace". */
export async function deleteSandbox(orgId: string): Promise<void> {
  await db
    .delete(organizations)
    .where(and(eq(organizations.id, orgId), eq(organizations.isSandbox, true)));
}

/** Reaps all expired sandbox orgs. Returns the count removed. */
export async function reapExpiredSandboxes(): Promise<number> {
  const expired = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(and(eq(organizations.isSandbox, true), lt(organizations.expiresAt, new Date())));
  if (!expired.length) return 0;
  await db
    .delete(organizations)
    .where(
      inArray(
        organizations.id,
        expired.map((e) => e.id)
      )
    );
  return expired.length;
}
