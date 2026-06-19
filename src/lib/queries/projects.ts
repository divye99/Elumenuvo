/**
 * Project + BOM data access — tenant-scoped.
 */
import { db } from "@/lib/db";
import {
  projects,
  boms,
  bomItems,
  products,
  brands,
} from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";

export async function listProjects(orgId: string) {
  return db
    .select()
    .from(projects)
    .where(eq(projects.organizationId, orgId))
    .orderBy(asc(projects.createdAt));
}

export async function getProject(orgId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.organizationId, orgId)))
    .limit(1);
  return project ?? null;
}

export type BomLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  phase: string | null;
  comparisonGroup: string | null;
  selectedBrand: string | null;
  selectedProductName: string | null;
  unitPrice: number;
  lineTotal: number;
};

export async function getProjectBom(orgId: string, projectId: string) {
  const [bom] = await db
    .select()
    .from(boms)
    .where(and(eq(boms.projectId, projectId), eq(boms.organizationId, orgId)))
    .limit(1);
  if (!bom) return { bom: null, lines: [] as BomLine[], total: 0 };

  const rows = await db
    .select({
      id: bomItems.id,
      description: bomItems.description,
      quantity: bomItems.quantity,
      unit: bomItems.unit,
      phase: bomItems.phase,
      comparisonGroup: bomItems.comparisonGroup,
      sortOrder: bomItems.sortOrder,
      unitPrice: bomItems.selectedUnitPrice,
      selectedProductName: products.name,
      selectedBrand: brands.name,
    })
    .from(bomItems)
    .leftJoin(products, eq(bomItems.selectedProductId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(bomItems.bomId, bom.id))
    .orderBy(asc(bomItems.sortOrder));

  const lines: BomLine[] = rows.map((r) => {
    const qty = Number(r.quantity);
    const price = Number(r.unitPrice ?? 0);
    return {
      id: r.id,
      description: r.description,
      quantity: qty,
      unit: r.unit,
      phase: r.phase,
      comparisonGroup: r.comparisonGroup,
      selectedBrand: r.selectedBrand,
      selectedProductName: r.selectedProductName,
      unitPrice: price,
      lineTotal: qty * price,
    };
  });

  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  return { bom, lines, total };
}
