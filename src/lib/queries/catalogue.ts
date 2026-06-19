/**
 * Catalogue data access — products, multi-brand price comparison, categories.
 * All Elume-owned (shared) data, no tenant scoping needed.
 */
import { db } from "@/lib/db";
import { products, brands, categories, productPrices } from "@/lib/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";

export type ComparisonRow = {
  comparisonGroup: string;
  label: string;
  categoryName: string;
  categorySlug: string;
  unit: string;
  specs: Record<string, unknown>;
  options: {
    productId: string;
    brand: string;
    brandSlug: string;
    name: string;
    skuCode: string;
    basePrice: number;
    mrp: number | null;
    leadTimeDays: number;
  }[];
};

export async function listCategories() {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.sortOrder));
}

/**
 * Returns one row per comparison group, each with every brand's option and its
 * base (qty-1) transparent price — the data behind the side-by-side comparison.
 * Optionally filtered to a category slug.
 */
export async function listComparisonGroups(categorySlug?: string): Promise<ComparisonRow[]> {
  const base = db
    .select({
      productId: products.id,
      productName: products.name,
      skuCode: products.skuCode,
      comparisonGroup: products.comparisonGroup,
      specs: products.specs,
      unit: products.unit,
      leadTimeDays: products.leadTimeDays,
      brand: brands.name,
      brandSlug: brands.slug,
      categoryName: categories.name,
      categorySlug: categories.slug,
      unitPrice: productPrices.unitPrice,
      mrp: productPrices.mrp,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .innerJoin(categories, eq(products.categoryId, categories.id))
    // base price = the qty-1 tier
    .innerJoin(
      productPrices,
      and(eq(productPrices.productId, products.id), eq(productPrices.minQty, 1))
    )
    .where(
      categorySlug
        ? and(eq(products.isActive, true), eq(categories.slug, categorySlug))
        : eq(products.isActive, true)
    )
    .orderBy(asc(products.comparisonGroup), asc(productPrices.unitPrice));

  const rows = await base;

  const grouped = new Map<string, ComparisonRow>();
  for (const r of rows) {
    const key = r.comparisonGroup ?? r.productId;
    if (!grouped.has(key)) {
      // Derive a clean group label from the cheapest option's product name,
      // stripping the brand prefix.
      const label = r.productName.replace(new RegExp(`^${r.brand}\\s+`), "");
      grouped.set(key, {
        comparisonGroup: key,
        label,
        categoryName: r.categoryName,
        categorySlug: r.categorySlug,
        unit: r.unit,
        specs: r.specs,
        options: [],
      });
    }
    grouped.get(key)!.options.push({
      productId: r.productId,
      brand: r.brand,
      brandSlug: r.brandSlug,
      name: r.productName,
      skuCode: r.skuCode,
      basePrice: Number(r.unitPrice),
      mrp: r.mrp ? Number(r.mrp) : null,
      leadTimeDays: r.leadTimeDays,
    });
  }

  return Array.from(grouped.values());
}

export async function catalogueStats() {
  const [row] = await db
    .select({
      products: sql<number>`count(distinct ${products.id})`,
      groups: sql<number>`count(distinct ${products.comparisonGroup})`,
      brands: sql<number>`count(distinct ${products.brandId})`,
    })
    .from(products)
    .where(eq(products.isActive, true));
  return row;
}
