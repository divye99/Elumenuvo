/**
 * Elume B2B FMEG Procurement Platform — Database Schema
 * ------------------------------------------------------
 * Grounded entirely in the Elume pitch deck + SISFS project report.
 *
 * Design principles:
 *  - Multi-tenant from day one: every buyer-owned row carries `organizationId`.
 *  - Catalogue (brands / categories / products / prices) is Elume-owned and shared.
 *  - Flexible product specs live in JSONB so we can model wires, MCBs, fans, etc.
 *    without a column explosion.
 *  - `comparisonGroup` links equivalent SKUs across brands so the platform can show
 *    live multi-brand price comparison per line item (Plan → Source & Price).
 *  - Buyer journey from the docs is modelled end to end:
 *    Plan (projects + BOM) → Source & Price (products + prices) →
 *    Order & Finance (purchase orders + credit) → Receive & Manage (deliveries + invoices).
 */

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
  date,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

// Buyer types named in the docs: contractors, real-estate developers, institutional buyers.
export const orgTypeEnum = pgEnum("org_type", [
  "contractor",
  "developer",
  "institutional",
]);

// Roles named in the docs: procurement managers, quantity surveyors, site engineers.
export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "procurement_manager",
  "quantity_surveyor",
  "site_engineer",
]);

// Construction stages from the docs: rough-in (conduits/wiring), panel (switchgear/DBs),
// finishing (fans/luminaires).
export const constructionPhaseEnum = pgEnum("construction_phase", [
  "rough_in",
  "panel",
  "finishing",
]);

// Project lifecycle.
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "completed",
]);

// BOM lifecycle + provenance (manual, BOQ upload, or Smart BOM — per the docs).
export const bomStatusEnum = pgEnum("bom_status", ["draft", "finalised"]);
export const bomSourceEnum = pgEnum("bom_source", [
  "manual",
  "boq_upload",
  "smart_bom",
]);

// Purchase order lifecycle (auto-generated, buyer approves release).
export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "pending_approval",
  "approved",
  "dispatched",
  "delivered",
  "cancelled",
]);

// Payment terms: prepaid or 30/60/90-day credit (the prevailing market norm in the docs).
export const paymentTermsEnum = pgEnum("payment_terms", [
  "prepaid",
  "credit_30",
  "credit_60",
  "credit_90",
]);

// Delivery + GRN tracking.
export const deliveryStatusEnum = pgEnum("delivery_status", [
  "scheduled",
  "dispatched",
  "delivered",
]);

// Invoice + payment tracking.
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "issued",
  "paid",
  "overdue",
]);

// NBFC-partnered credit (referral model — Elume never lends from its own balance sheet).
export const creditStatusEnum = pgEnum("credit_status", [
  "not_applied",
  "under_review",
  "approved",
  "rejected",
]);

// Compatibility-check severity (wire gauge ↔ MCB rating, etc.).
export const compatSeverityEnum = pgEnum("compat_severity", [
  "error",
  "warning",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

/* ================================================================== */
/* 1. CATALOGUE  (Elume-owned, shared across all tenants)             */
/* ================================================================== */

// Brands named in the docs: Havells, Polycab, Anchor, Finolex, Crompton,
// Syska, Legrand, Schneider, ABB.
export const brands = pgTable("brands", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  logoUrl: text("logo_url"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

// Categories from the docs (self-referencing for sub-categories):
// wires & cables, switchgear (MCBs/RCCBs/isolators), modular switches,
// distribution boards & panels, LED lighting, fans, accessories.
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    parentId: uuid("parent_id"),
    description: text("description"),
    sortOrder: integer("sort_order").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (t) => ({
    parentIdx: index("categories_parent_idx").on(t.parentId),
  })
);

// Distributors / stockists Elume sources from (just-in-time trading model).
export const distributors = pgTable("distributors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  region: text("region"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

// A product = a sellable SKU. Specs are flexible JSONB (wire gauge, MCB rating,
// poles, fan sweep, lumens, etc.). `comparisonGroup` ties equivalent SKUs across
// brands together so the platform can show multi-brand price comparison per line.
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    skuCode: text("sku_code").notNull().unique(),
    description: text("description"),
    // e.g. { "gauge_sqmm": 1.5, "core": "single", "insulation": "FR", "rating_a": 16 }
    specs: jsonb("specs").$type<Record<string, unknown>>().default({}).notNull(),
    // Equivalence key across brands, e.g. "wire_fr_1.5sqmm", "mcb_sp_16a_c".
    comparisonGroup: text("comparison_group"),
    // Unit of sale: "metre", "coil", "piece", "box", etc.
    unit: text("unit").notNull().default("piece"),
    hsnCode: text("hsn_code"),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18").notNull(),
    imageUrl: text("image_url"),
    leadTimeDays: integer("lead_time_days").default(2).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (t) => ({
    brandIdx: index("products_brand_idx").on(t.brandId),
    categoryIdx: index("products_category_idx").on(t.categoryId),
    comparisonIdx: index("products_comparison_idx").on(t.comparisonGroup),
  })
);

// Volume-based pricing tiers (the docs: "volume-based pricing tiers for repeat /
// high-volume buyers"). Each row is one tier for one product. `mrp` lets us show
// the saving vs list price; `unitPrice` is the Elume transparent price.
export const productPrices = pgTable(
  "product_prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    distributorId: uuid("distributor_id").references(() => distributors.id),
    minQty: integer("min_qty").default(1).notNull(),
    maxQty: integer("max_qty"), // null = no upper bound
    mrp: numeric("mrp", { precision: 12, scale: 2 }),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").default("INR").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true })
      .defaultNow()
      .notNull(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (t) => ({
    productIdx: index("product_prices_product_idx").on(t.productId),
  })
);

// Compatibility rules for BOM checks (e.g. wire gauge ↔ MCB rating). Evaluated
// against the JSONB specs of two line items. Kept simple + data-driven so the
// rule set can grow without code changes.
export const compatibilityRules = pgTable("compatibility_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // Categories this rule relates, e.g. "wires-cables" ↔ "switchgear".
  categorySlugA: text("category_slug_a").notNull(),
  categorySlugB: text("category_slug_b").notNull(),
  // Declarative logic (spec keys + comparison) interpreted by the rule engine.
  logic: jsonb("logic").$type<Record<string, unknown>>().notNull(),
  message: text("message").notNull(),
  severity: compatSeverityEnum("severity").default("warning").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  ...timestamps,
});

/* ================================================================== */
/* 2. TENANTS  (buyer organisations + users)                          */
/* ================================================================== */

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    type: orgTypeEnum("type").default("contractor").notNull(),
    gstin: text("gstin"),
    city: text("city"),
    state: text("state"),
    addressLine: text("address_line"),
    // ── Sandbox / trial fields ──────────────────────────────────────
    // `isTemplate` marks the seeded org that per-visitor sandboxes clone from.
    isTemplate: boolean("is_template").default(false).notNull(),
    // `isSandbox` marks an ephemeral per-visitor trial workspace.
    isSandbox: boolean("is_sandbox").default(false).notNull(),
    // The template this sandbox was cloned from (provenance).
    templateOrgId: uuid("template_org_id"),
    // When a sandbox should be reaped (null for real/template orgs).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    sandboxIdx: index("organizations_sandbox_idx").on(t.isSandbox, t.expiresAt),
  })
);

// Lead capture — marketing contact + "save my workspace" trial conversion.
export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  company: text("company"),
  phone: text("phone"),
  // Where the lead came from: "contact", "save_workspace", "demo_request", etc.
  source: text("source").default("contact").notNull(),
  message: text("message"),
  // If captured from inside a trial, the sandbox org they were exploring.
  sandboxOrgId: uuid("sandbox_org_id"),
  ...timestamps,
});

// Mirrors Supabase auth.users (id = auth uid). Profile data lives here.
export const users = pgTable("users", {
  id: uuid("id").primaryKey(), // = auth.users.id
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phone: text("phone"),
  ...timestamps,
});

// A user belongs to one or more organisations with a role.
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").default("procurement_manager").notNull(),
    ...timestamps,
  },
  (t) => ({
    uniqueMember: uniqueIndex("memberships_org_user_idx").on(
      t.organizationId,
      t.userId
    ),
    orgIdx: index("memberships_org_idx").on(t.organizationId),
    userIdx: index("memberships_user_idx").on(t.userId),
  })
);

/* ================================================================== */
/* 3. PLAN  (projects + BOM)                                          */
/* ================================================================== */

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location"),
    city: text("city"),
    scope: text("scope"),
    stage: constructionPhaseEnum("stage").default("rough_in"),
    status: projectStatusEnum("status").default("planning").notNull(),
    budgetAmount: numeric("budget_amount", { precision: 14, scale: 2 }),
    startDate: date("start_date"),
    expectedEndDate: date("expected_end_date"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("projects_org_idx").on(t.organizationId),
  })
);

export const boms = pgTable(
  "boms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Bill of Materials"),
    status: bomStatusEnum("status").default("draft").notNull(),
    source: bomSourceEnum("source").default("manual").notNull(),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => ({
    projectIdx: index("boms_project_idx").on(t.projectId),
    orgIdx: index("boms_org_idx").on(t.organizationId),
  })
);

// A BOM line item is a requirement (category + spec + qty) optionally resolved to
// a chosen branded product. `comparisonGroup` drives the multi-brand price compare.
// `phase` ties the line to a construction stage for the phased schedule.
export const bomItems = pgTable(
  "bom_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    bomId: uuid("bom_id")
      .notNull()
      .references(() => boms.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id),
    comparisonGroup: text("comparison_group"),
    // Free-text description of the requirement (from BOQ line or manual entry).
    description: text("description").notNull(),
    requirementSpecs: jsonb("requirement_specs")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: text("unit").default("piece").notNull(),
    phase: constructionPhaseEnum("phase"),
    // Chosen branded SKU + the price snapshot at selection time.
    selectedProductId: uuid("selected_product_id").references(() => products.id),
    selectedUnitPrice: numeric("selected_unit_price", { precision: 12, scale: 2 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    ...timestamps,
  },
  (t) => ({
    bomIdx: index("bom_items_bom_idx").on(t.bomId),
    orgIdx: index("bom_items_org_idx").on(t.organizationId),
  })
);

/* ================================================================== */
/* 4. ORDER & FINANCE  (purchase orders + NBFC credit)                */
/* ================================================================== */

// NBFC-partnered credit profile per org (referral model — no Elume balance sheet).
export const creditProfiles = pgTable("credit_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" })
    .unique(),
  status: creditStatusEnum("status").default("not_applied").notNull(),
  approvedLimit: numeric("approved_limit", { precision: 14, scale: 2 }).default("0"),
  utilisedAmount: numeric("utilised_amount", { precision: 14, scale: 2 }).default("0"),
  nbfcPartner: text("nbfc_partner"),
  // Proprietary FMEG credit score (0-100) — built from order + repayment data.
  creditScore: integer("credit_score"),
  defaultTenureDays: integer("default_tenure_days").default(60),
  ...timestamps,
});

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    bomId: uuid("bom_id").references(() => boms.id, { onDelete: "set null" }),
    poNumber: text("po_number").notNull().unique(),
    phase: constructionPhaseEnum("phase"),
    status: poStatusEnum("status").default("draft").notNull(),
    paymentTerms: paymentTermsEnum("payment_terms").default("prepaid").notNull(),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }).default("0").notNull(),
    taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0").notNull(),
    expectedDelivery: date("expected_delivery"),
    createdBy: uuid("created_by").references(() => users.id),
    ...timestamps,
  },
  (t) => ({
    orgIdx: index("purchase_orders_org_idx").on(t.organizationId),
    projectIdx: index("purchase_orders_project_idx").on(t.projectId),
  })
);

export const poItems = pgTable(
  "po_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    unit: text("unit").default("piece").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
    gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).default("18").notNull(),
    lineTotal: numeric("line_total", { precision: 14, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => ({
    poIdx: index("po_items_po_idx").on(t.purchaseOrderId),
  })
);

/* ================================================================== */
/* 5. RECEIVE & MANAGE  (deliveries + invoices)                       */
/* ================================================================== */

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    status: deliveryStatusEnum("status").default("scheduled").notNull(),
    eta: date("eta"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    grnConfirmed: boolean("grn_confirmed").default(false).notNull(),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => ({
    poIdx: index("deliveries_po_idx").on(t.purchaseOrderId),
  })
);

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull().unique(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    status: invoiceStatusEnum("status").default("issued").notNull(),
    dueDate: date("due_date"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => ({
    poIdx: index("invoices_po_idx").on(t.purchaseOrderId),
  })
);
