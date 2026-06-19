/**
 * Seed script — loads a representative FMEG catalogue + a demo buyer tenant.
 *
 * Everything here is grounded in the Elume documents:
 *  - Brands:     Havells, Polycab, Anchor, Finolex, Crompton, Syska, Legrand, Schneider, ABB
 *  - Categories: wires & cables, switchgear (MCB/RCCB/isolator), modular switches,
 *                distribution boards, LED lighting, fans, accessories
 *  - Buyer:      mid-to-large contractor in the Western-UP belt (Noida/Ghaziabad/Meerut)
 *
 * Pricing is illustrative (the docs contain no price lists); the tier logic follows
 * the docs' "volume-based pricing tiers" + "transparent pricing vs MRP" model.
 *
 * Run with:  npm run db:seed   (after npm run db:push)
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const {
  brands,
  categories,
  distributors,
  products,
  productPrices,
  compatibilityRules,
  organizations,
  users,
  memberships,
  creditProfiles,
  projects,
  boms,
  bomItems,
  purchaseOrders,
  poItems,
  deliveries,
  invoices,
} = schema;

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing — fill in .env.local first.");

const client = postgres(url, { prepare: false });
const db = drizzle(client, { schema });

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* ------------------------------------------------------------------ */
/* Reference data                                                     */
/* ------------------------------------------------------------------ */

const BRANDS = [
  { name: "Havells", description: "Wires, switchgear, lighting & fans" },
  { name: "Polycab", description: "Wires & cables, lighting, fans" },
  { name: "Finolex", description: "Wires & cables" },
  { name: "Anchor", description: "Switches, wires & fans (Panasonic)" },
  { name: "Crompton", description: "Fans, lighting & pumps" },
  { name: "Syska", description: "LED lighting" },
  { name: "Legrand", description: "Switchgear, modular switches & DBs" },
  { name: "Schneider", description: "Switchgear, switches & distribution" },
  { name: "ABB", description: "Switchgear & protection devices" },
];

// parent slug -> null for top-level
const CATEGORIES = [
  { name: "Wires & Cables", slug: "wires-cables", parent: null, sort: 1 },
  { name: "Switchgear", slug: "switchgear", parent: null, sort: 2 },
  { name: "MCBs", slug: "mcbs", parent: "switchgear", sort: 1 },
  { name: "RCCBs", slug: "rccbs", parent: "switchgear", sort: 2 },
  { name: "Isolators", slug: "isolators", parent: "switchgear", sort: 3 },
  { name: "Modular Switches & Accessories", slug: "modular-switches", parent: null, sort: 3 },
  { name: "Distribution Boards & Panels", slug: "distribution-boards", parent: null, sort: 4 },
  { name: "LED Lighting & Luminaires", slug: "led-lighting", parent: null, sort: 5 },
  { name: "Fans", slug: "fans", parent: null, sort: 6 },
  { name: "Electrical Accessories", slug: "accessories", parent: null, sort: 7 },
];

const DISTRIBUTORS = [
  { name: "NCR Electricals Distributors", region: "Noida" },
  { name: "Ghaziabad Power Stockists", region: "Ghaziabad" },
  { name: "Meerut Trade Supplies", region: "Meerut" },
];

type Variant = { brand: string; mrp: number; price: number; lead?: number };
type Group = {
  group: string;
  category: string;
  unit: string;
  label: string;
  specs: Record<string, unknown>;
  gst?: number;
  variants: Variant[];
};

// Comparison groups: equivalent SKUs across brands → multi-brand price comparison.
const CATALOGUE: Group[] = [
  // ── Wires & Cables (90m coil) ────────────────────────────────────
  {
    group: "wire-fr-1sqmm", category: "wires-cables", unit: "coil",
    label: "1.0 sq mm FR Single-Core House Wire (90m Coil)",
    specs: { gauge_sqmm: 1.0, cores: 1, insulation: "FR", length_m: 90, max_load_a: 11 },
    variants: [
      { brand: "Havells", mrp: 1390, price: 1110 }, { brand: "Polycab", mrp: 1340, price: 1060 },
      { brand: "Finolex", mrp: 1290, price: 1030 }, { brand: "Anchor", mrp: 1240, price: 990 },
    ],
  },
  {
    group: "wire-fr-1.5sqmm", category: "wires-cables", unit: "coil",
    label: "1.5 sq mm FR Single-Core House Wire (90m Coil)",
    specs: { gauge_sqmm: 1.5, cores: 1, insulation: "FR", length_m: 90, max_load_a: 16 },
    variants: [
      { brand: "Havells", mrp: 1850, price: 1480 }, { brand: "Polycab", mrp: 1790, price: 1420 },
      { brand: "Finolex", mrp: 1720, price: 1390 }, { brand: "Anchor", mrp: 1650, price: 1330 },
    ],
  },
  {
    group: "wire-fr-2.5sqmm", category: "wires-cables", unit: "coil",
    label: "2.5 sq mm FR Single-Core House Wire (90m Coil)",
    specs: { gauge_sqmm: 2.5, cores: 1, insulation: "FR", length_m: 90, max_load_a: 24 },
    variants: [
      { brand: "Havells", mrp: 2950, price: 2360 }, { brand: "Polycab", mrp: 2860, price: 2280 },
      { brand: "Finolex", mrp: 2740, price: 2210 }, { brand: "Anchor", mrp: 2640, price: 2120 },
    ],
  },
  {
    group: "wire-fr-4sqmm", category: "wires-cables", unit: "coil",
    label: "4.0 sq mm FR Single-Core House Wire (90m Coil)",
    specs: { gauge_sqmm: 4.0, cores: 1, insulation: "FR", length_m: 90, max_load_a: 32 },
    variants: [
      { brand: "Havells", mrp: 4550, price: 3640 }, { brand: "Polycab", mrp: 4420, price: 3520 },
      { brand: "Finolex", mrp: 4260, price: 3430 },
    ],
  },
  {
    group: "wire-fr-6sqmm", category: "wires-cables", unit: "coil",
    label: "6.0 sq mm FR Single-Core House Wire (90m Coil)",
    specs: { gauge_sqmm: 6.0, cores: 1, insulation: "FR", length_m: 90, max_load_a: 42 },
    variants: [
      { brand: "Havells", mrp: 6650, price: 5320 }, { brand: "Polycab", mrp: 6450, price: 5160 },
      { brand: "Finolex", mrp: 6220, price: 5010 },
    ],
  },

  // ── Switchgear: MCBs ─────────────────────────────────────────────
  {
    group: "mcb-sp-6a-c", category: "mcbs", unit: "piece",
    label: "6A Single-Pole C-Curve MCB",
    specs: { poles: 1, rating_a: 6, curve: "C", breaking_kA: 10 },
    variants: [
      { brand: "Havells", mrp: 235, price: 165 }, { brand: "Legrand", mrp: 255, price: 180 },
      { brand: "Schneider", mrp: 270, price: 190 }, { brand: "ABB", mrp: 290, price: 205 },
    ],
  },
  {
    group: "mcb-sp-16a-c", category: "mcbs", unit: "piece",
    label: "16A Single-Pole C-Curve MCB",
    specs: { poles: 1, rating_a: 16, curve: "C", breaking_kA: 10 },
    variants: [
      { brand: "Havells", mrp: 245, price: 172 }, { brand: "Legrand", mrp: 265, price: 188 },
      { brand: "Schneider", mrp: 280, price: 198 }, { brand: "ABB", mrp: 300, price: 212 },
      { brand: "Polycab", mrp: 230, price: 160 },
    ],
  },
  {
    group: "mcb-sp-32a-c", category: "mcbs", unit: "piece",
    label: "32A Single-Pole C-Curve MCB",
    specs: { poles: 1, rating_a: 32, curve: "C", breaking_kA: 10 },
    variants: [
      { brand: "Havells", mrp: 265, price: 188 }, { brand: "Legrand", mrp: 285, price: 202 },
      { brand: "Schneider", mrp: 300, price: 214 }, { brand: "ABB", mrp: 320, price: 228 },
    ],
  },
  {
    group: "mcb-dp-40a-c", category: "mcbs", unit: "piece",
    label: "40A Double-Pole C-Curve MCB",
    specs: { poles: 2, rating_a: 40, curve: "C", breaking_kA: 10 },
    variants: [
      { brand: "Havells", mrp: 720, price: 505 }, { brand: "Legrand", mrp: 760, price: 540 },
      { brand: "Schneider", mrp: 790, price: 560 }, { brand: "ABB", mrp: 830, price: 590 },
    ],
  },

  // ── Switchgear: RCCBs ────────────────────────────────────────────
  {
    group: "rccb-dp-40a-30ma", category: "rccbs", unit: "piece",
    label: "40A Double-Pole 30mA RCCB",
    specs: { poles: 2, rating_a: 40, sensitivity_ma: 30 },
    variants: [
      { brand: "Havells", mrp: 1850, price: 1295 }, { brand: "Legrand", mrp: 1980, price: 1390 },
      { brand: "Schneider", mrp: 2050, price: 1440 }, { brand: "ABB", mrp: 2180, price: 1530 },
    ],
  },
  {
    group: "rccb-fp-63a-30ma", category: "rccbs", unit: "piece",
    label: "63A Four-Pole 30mA RCCB",
    specs: { poles: 4, rating_a: 63, sensitivity_ma: 30 },
    variants: [
      { brand: "Havells", mrp: 3450, price: 2415 }, { brand: "Legrand", mrp: 3680, price: 2580 },
      { brand: "Schneider", mrp: 3820, price: 2670 }, { brand: "ABB", mrp: 4050, price: 2840 },
    ],
  },

  // ── Switchgear: Isolators ────────────────────────────────────────
  {
    group: "isolator-dp-63a", category: "isolators", unit: "piece",
    label: "63A Double-Pole Isolator",
    specs: { poles: 2, rating_a: 63 },
    variants: [
      { brand: "Havells", mrp: 540, price: 380 }, { brand: "Legrand", mrp: 580, price: 410 },
      { brand: "ABB", mrp: 620, price: 440 },
    ],
  },

  // ── Modular Switches & Accessories ───────────────────────────────
  {
    group: "switch-1way-6a", category: "modular-switches", unit: "piece",
    label: "6A One-Way Modular Switch",
    specs: { rating_a: 6, way: "one", modules: 1 },
    variants: [
      { brand: "Anchor", mrp: 95, price: 62 }, { brand: "Legrand", mrp: 145, price: 98 },
      { brand: "Havells", mrp: 120, price: 80 }, { brand: "Schneider", mrp: 150, price: 102 },
    ],
  },
  {
    group: "switch-2way-16a", category: "modular-switches", unit: "piece",
    label: "16A Two-Way Modular Switch",
    specs: { rating_a: 16, way: "two", modules: 1 },
    variants: [
      { brand: "Anchor", mrp: 165, price: 110 }, { brand: "Legrand", mrp: 220, price: 150 },
      { brand: "Havells", mrp: 195, price: 132 }, { brand: "Schneider", mrp: 235, price: 160 },
    ],
  },
  {
    group: "socket-6a-3pin", category: "modular-switches", unit: "piece",
    label: "6A 3-Pin Modular Socket",
    specs: { rating_a: 6, pins: 3, modules: 2 },
    variants: [
      { brand: "Anchor", mrp: 135, price: 90 }, { brand: "Legrand", mrp: 185, price: 126 },
      { brand: "Havells", mrp: 160, price: 108 },
    ],
  },
  {
    group: "socket-combo-6-16a", category: "modular-switches", unit: "piece",
    label: "6A/16A Combination Modular Socket",
    specs: { rating_a: 16, pins: 6, modules: 3 },
    variants: [
      { brand: "Anchor", mrp: 245, price: 165 }, { brand: "Legrand", mrp: 320, price: 218 },
      { brand: "Havells", mrp: 285, price: 192 }, { brand: "Schneider", mrp: 340, price: 232 },
    ],
  },

  // ── Distribution Boards & Panels ─────────────────────────────────
  {
    group: "db-4way-spn", category: "distribution-boards", unit: "piece",
    label: "4-Way SPN Distribution Board (Double Door)",
    specs: { ways: 4, type: "SPN", door: "double" },
    variants: [
      { brand: "Havells", mrp: 1250, price: 875 }, { brand: "Legrand", mrp: 1380, price: 965 },
      { brand: "Schneider", mrp: 1450, price: 1015 }, { brand: "ABB", mrp: 1520, price: 1065 },
    ],
  },
  {
    group: "db-8way-spn", category: "distribution-boards", unit: "piece",
    label: "8-Way SPN Distribution Board (Double Door)",
    specs: { ways: 8, type: "SPN", door: "double" },
    variants: [
      { brand: "Havells", mrp: 1950, price: 1365 }, { brand: "Legrand", mrp: 2150, price: 1505 },
      { brand: "Schneider", mrp: 2280, price: 1595 }, { brand: "ABB", mrp: 2390, price: 1675 },
    ],
  },
  {
    group: "db-12way-tpn", category: "distribution-boards", unit: "piece",
    label: "12-Way TPN Distribution Board",
    specs: { ways: 12, type: "TPN", door: "double" },
    variants: [
      { brand: "Havells", mrp: 4250, price: 2975 }, { brand: "Legrand", mrp: 4650, price: 3255 },
      { brand: "Schneider", mrp: 4880, price: 3415 }, { brand: "ABB", mrp: 5150, price: 3605 },
    ],
  },

  // ── LED Lighting & Luminaires ────────────────────────────────────
  {
    group: "led-panel-15w-round", category: "led-lighting", unit: "piece",
    label: "15W Round LED Panel Light (Cool White)",
    specs: { wattage: 15, shape: "round", cct_k: 6500, lumens: 1350 },
    variants: [
      { brand: "Havells", mrp: 650, price: 420 }, { brand: "Syska", mrp: 590, price: 375 },
      { brand: "Crompton", mrp: 620, price: 398 }, { brand: "Polycab", mrp: 610, price: 392 },
    ],
  },
  {
    group: "led-panel-22w-square", category: "led-lighting", unit: "piece",
    label: "22W Square LED Panel Light (Cool White)",
    specs: { wattage: 22, shape: "square", cct_k: 6500, lumens: 1980 },
    variants: [
      { brand: "Havells", mrp: 880, price: 565 }, { brand: "Syska", mrp: 810, price: 515 },
      { brand: "Crompton", mrp: 845, price: 540 },
    ],
  },
  {
    group: "led-batten-20w", category: "led-lighting", unit: "piece",
    label: "20W LED Batten (4 ft, Cool White)",
    specs: { wattage: 20, length_ft: 4, cct_k: 6500, lumens: 2000 },
    variants: [
      { brand: "Havells", mrp: 520, price: 335 }, { brand: "Syska", mrp: 470, price: 298 },
      { brand: "Crompton", mrp: 495, price: 318 }, { brand: "Polycab", mrp: 485, price: 312 },
    ],
  },
  {
    group: "led-floodlight-50w", category: "led-lighting", unit: "piece",
    label: "50W LED Flood Light (IP65, Cool White)",
    specs: { wattage: 50, ip_rating: "IP65", cct_k: 6500, lumens: 4500 },
    variants: [
      { brand: "Havells", mrp: 2150, price: 1380 }, { brand: "Syska", mrp: 1950, price: 1245 },
      { brand: "Crompton", mrp: 2050, price: 1315 },
    ],
  },

  // ── Fans ─────────────────────────────────────────────────────────
  {
    group: "ceiling-fan-1200mm", category: "fans", unit: "piece",
    label: "1200mm Ceiling Fan (High-Speed)",
    specs: { sweep_mm: 1200, type: "ceiling", speed_rpm: 380 },
    variants: [
      { brand: "Crompton", mrp: 2350, price: 1645 }, { brand: "Havells", mrp: 2650, price: 1855 },
      { brand: "Polycab", mrp: 2280, price: 1595 }, { brand: "Anchor", mrp: 2150, price: 1505 },
    ],
  },
  {
    group: "ceiling-fan-1400mm", category: "fans", unit: "piece",
    label: "1400mm Ceiling Fan (High-Speed)",
    specs: { sweep_mm: 1400, type: "ceiling", speed_rpm: 350 },
    variants: [
      { brand: "Crompton", mrp: 2750, price: 1925 }, { brand: "Havells", mrp: 3050, price: 2135 },
      { brand: "Polycab", mrp: 2680, price: 1875 },
    ],
  },
  {
    group: "exhaust-fan-150mm", category: "fans", unit: "piece",
    label: "150mm Exhaust Fan",
    specs: { sweep_mm: 150, type: "exhaust" },
    variants: [
      { brand: "Crompton", mrp: 1450, price: 1015 }, { brand: "Havells", mrp: 1620, price: 1135 },
      { brand: "Anchor", mrp: 1380, price: 965 },
    ],
  },
];

// Volume tiers (the docs' "volume-based pricing tiers"): base, 10+, 50+.
const TIERS = [
  { minQty: 1, maxQty: 9, factor: 1.0 },
  { minQty: 10, maxQty: 49, factor: 0.96 },
  { minQty: 50, maxQty: null as number | null, factor: 0.92 },
];

async function main() {
  console.log("🌱 Seeding Elume catalogue + demo tenant…");

  /* ---- wipe (FK-safe order) for idempotent re-runs ---- */
  await db.delete(invoices);
  await db.delete(deliveries);
  await db.delete(poItems);
  await db.delete(purchaseOrders);
  await db.delete(bomItems);
  await db.delete(boms);
  await db.delete(projects);
  await db.delete(creditProfiles);
  await db.delete(memberships);
  await db.delete(productPrices);
  await db.delete(products);
  await db.delete(compatibilityRules);
  await db.delete(categories);
  await db.delete(brands);
  await db.delete(distributors);
  await db.delete(users);
  await db.delete(organizations);

  /* ---- brands ---- */
  const brandRows = await db
    .insert(brands)
    .values(BRANDS.map((b) => ({ name: b.name, slug: slugify(b.name), description: b.description })))
    .returning();
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b.id]));

  /* ---- categories (parents first, then children) ---- */
  const catId = new Map<string, string>();
  for (const c of CATEGORIES.filter((c) => !c.parent)) {
    const [row] = await db
      .insert(categories)
      .values({ name: c.name, slug: c.slug, sortOrder: c.sort })
      .returning();
    catId.set(c.slug, row.id);
  }
  for (const c of CATEGORIES.filter((c) => c.parent)) {
    const [row] = await db
      .insert(categories)
      .values({ name: c.name, slug: c.slug, sortOrder: c.sort, parentId: catId.get(c.parent!) })
      .returning();
    catId.set(c.slug, row.id);
  }

  /* ---- distributors ---- */
  const distRows = await db.insert(distributors).values(DISTRIBUTORS).returning();

  /* ---- products + price tiers ---- */
  let productCount = 0;
  let priceCount = 0;
  for (const g of CATALOGUE) {
    for (const v of g.variants) {
      const brandSlug = slugify(v.brand);
      const brandId = brandBySlug.get(brandSlug);
      const categoryId = catId.get(g.category);
      if (!brandId || !categoryId) {
        throw new Error(`Missing brand/category for ${v.brand} / ${g.category}`);
      }
      const sku = `${brandSlug}-${g.group}`.toUpperCase();
      const [prod] = await db
        .insert(products)
        .values({
          brandId,
          categoryId,
          name: `${v.brand} ${g.label}`,
          slug: slugify(`${v.brand}-${g.group}`),
          skuCode: sku,
          specs: g.specs,
          comparisonGroup: g.group,
          unit: g.unit,
          gstRate: String(g.gst ?? 18),
          leadTimeDays: v.lead ?? 2,
        })
        .returning();
      productCount++;

      for (const t of TIERS) {
        await db.insert(productPrices).values({
          productId: prod.id,
          distributorId: distRows[productCount % distRows.length].id,
          minQty: t.minQty,
          maxQty: t.maxQty,
          mrp: String(v.mrp),
          unitPrice: (v.price * t.factor).toFixed(2),
        });
        priceCount++;
      }
    }
  }

  /* ---- compatibility rule: wire gauge ↔ MCB rating ---- */
  await db.insert(compatibilityRules).values({
    name: "Wire gauge vs MCB rating",
    description:
      "An MCB must not be rated above the safe current-carrying capacity of the chosen wire gauge.",
    categorySlugA: "wires-cables",
    categorySlugB: "mcbs",
    logic: {
      type: "ampacity",
      wireSpecKey: "max_load_a",
      breakerSpecKey: "rating_a",
      rule: "breaker.rating_a <= wire.max_load_a",
    },
    message: "Selected MCB rating exceeds the safe ampacity of the chosen wire gauge.",
    severity: "error",
  });

  /* ================================================================ */
  /* Demo tenant: a mid-size contractor in the Western-UP belt         */
  /* ================================================================ */
  const [org] = await db
    .insert(organizations)
    .values({
      name: "Skyline Electricals & Contractors",
      slug: "skyline-electricals",
      type: "contractor",
      gstin: "09AABCS1429K1Z5",
      city: "Noida",
      state: "Uttar Pradesh",
      addressLine: "B-42, Sector 63, Noida",
      // This org is the template that every per-visitor sandbox is cloned from.
      isTemplate: true,
    })
    .returning();

  // Fixed demo user id (mapped to a real Supabase auth user when login is wired).
  const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
  await db.insert(users).values({
    id: DEMO_USER_ID,
    email: "procurement@skyline.example",
    fullName: "Rahul Verma",
    phone: "+91 98100 00000",
  });
  await db.insert(memberships).values({
    organizationId: org.id,
    userId: DEMO_USER_ID,
    role: "procurement_manager",
  });

  // NBFC-partnered credit profile (referral model — approved limit, partial utilisation).
  await db.insert(creditProfiles).values({
    organizationId: org.id,
    status: "approved",
    approvedLimit: "2500000",
    utilisedAmount: "820000",
    nbfcPartner: "TradeCred NBFC (Partner)",
    creditScore: 72,
    defaultTenureDays: 60,
  });

  // Multiple concurrent sites → the multi-site project dashboard.
  const projectSeeds = [
    { name: "Prestige Tower B — Noida", location: "Sector 150, Noida", city: "Noida",
      scope: "32-floor residential — electrical fit-out", stage: "panel" as const,
      status: "active" as const, budget: "4500000", spendFactor: 0.62 },
    { name: "M3M Residency Phase 2 — Gurugram", location: "Sector 94, Gurugram", city: "Gurugram",
      scope: "Twin-tower wiring & switchgear", stage: "rough_in" as const,
      status: "active" as const, budget: "12000000", spendFactor: 0.28 },
    { name: "Civic Centre — Ghaziabad", location: "Raj Nagar, Ghaziabad", city: "Ghaziabad",
      scope: "Commercial complex lighting & DBs", stage: "finishing" as const,
      status: "active" as const, budget: "3000000", spendFactor: 0.84 },
    { name: "Meerut Warehouse Park", location: "Partapur, Meerut", city: "Meerut",
      scope: "Industrial shed — power & lighting", stage: "rough_in" as const,
      status: "planning" as const, budget: "1800000", spendFactor: 0.0 },
  ];

  // Pre-fetch catalogue once; pick a product by comparison group + preferred brand.
  const allProducts = await db.select().from(products);
  const allPrices = await db.select().from(productPrices);
  function pickProduct(group: string, brand: string) {
    const brandId = brandBySlug.get(slugify(brand));
    return allProducts.find((p) => p.comparisonGroup === group && p.brandId === brandId);
  }

  let poSeq = 1001;
  let invSeq = 5001;

  for (const ps of projectSeeds) {
    const [project] = await db
      .insert(projects)
      .values({
        organizationId: org.id,
        name: ps.name,
        location: ps.location,
        city: ps.city,
        scope: ps.scope,
        stage: ps.stage,
        status: ps.status,
        budgetAmount: ps.budget,
        createdBy: DEMO_USER_ID,
      })
      .returning();

    const [bom] = await db
      .insert(boms)
      .values({
        organizationId: org.id,
        projectId: project.id,
        name: "Electrical BOM",
        status: ps.status === "planning" ? "draft" : "finalised",
        source: "manual",
        createdBy: DEMO_USER_ID,
      })
      .returning();

    // A small phased BOM: rough-in wires, panel switchgear/DBs, finishing fans/lights.
    const lineSpec: {
      group: string; brand: string; desc: string; qty: number; unit: string;
      phase: "rough_in" | "panel" | "finishing";
    }[] = [
      { group: "wire-fr-2.5sqmm", brand: "Polycab", desc: "2.5 sq mm FR wire (90m coil)", qty: 40, unit: "coil", phase: "rough_in" },
      { group: "wire-fr-1.5sqmm", brand: "Finolex", desc: "1.5 sq mm FR wire (90m coil)", qty: 60, unit: "coil", phase: "rough_in" },
      { group: "mcb-sp-16a-c", brand: "Havells", desc: "16A SP MCB", qty: 120, unit: "piece", phase: "panel" },
      { group: "db-8way-spn", brand: "Legrand", desc: "8-Way SPN DB", qty: 18, unit: "piece", phase: "panel" },
      { group: "led-batten-20w", brand: "Syska", desc: "20W LED Batten", qty: 200, unit: "piece", phase: "finishing" },
      { group: "ceiling-fan-1200mm", brand: "Crompton", desc: "1200mm Ceiling Fan", qty: 80, unit: "piece", phase: "finishing" },
    ];

    let sort = 0;
    type Picked = { productId: string; unitPrice: number; qty: number; desc: string; unit: string; phase: "rough_in" | "panel" | "finishing"; gst: number };
    const picked: Picked[] = [];

    for (const ln of lineSpec) {
      const prod = pickProduct(ln.group, ln.brand);
      if (!prod) continue;
      const base = allPrices
        .filter((p) => p.productId === prod.id)
        .sort((a, b) => a.minQty - b.minQty)
        .find((p) => ln.qty >= p.minQty && (p.maxQty === null || ln.qty <= p.maxQty));
      const unitPrice = Number(base?.unitPrice ?? 0);

      await db.insert(bomItems).values({
        organizationId: org.id,
        bomId: bom.id,
        categoryId: prod.categoryId,
        comparisonGroup: ln.group,
        description: ln.desc,
        requirementSpecs: {},
        quantity: String(ln.qty),
        unit: ln.unit,
        phase: ln.phase,
        selectedProductId: prod.id,
        selectedUnitPrice: String(unitPrice),
        sortOrder: sort++,
      });

      picked.push({ productId: prod.id, unitPrice, qty: ln.qty, desc: ln.desc, unit: ln.unit, phase: ln.phase, gst: Number(prod.gstRate) });
    }

    if (ps.status === "planning") continue; // planning project: BOM only, no orders yet

    // Generate POs per phase up to the project's spend factor.
    const phases: ("rough_in" | "panel" | "finishing")[] = ["rough_in", "panel", "finishing"];
    for (const phase of phases) {
      const phaseItems = picked.filter((p) => p.phase === phase);
      if (!phaseItems.length) continue;

      // Only realise spend roughly matching the project's progress.
      const realise = phase === "rough_in" ? ps.spendFactor >= 0.2
        : phase === "panel" ? ps.spendFactor >= 0.5
        : ps.spendFactor >= 0.8;
      if (!realise) continue;

      let subtotal = 0;
      let tax = 0;
      const poItemRows = phaseItems.map((it) => {
        const line = it.unitPrice * it.qty;
        const lineTax = (line * it.gst) / 100;
        subtotal += line;
        tax += lineTax;
        return { it, line, lineTax };
      });
      const total = subtotal + tax;

      const delivered = phase !== "finishing"; // earlier phases already delivered
      const useCredit = total > 200000;

      const [po] = await db
        .insert(purchaseOrders)
        .values({
          organizationId: org.id,
          projectId: project.id,
          bomId: bom.id,
          poNumber: `PO-${poSeq++}`,
          phase,
          status: delivered ? "delivered" : "approved",
          paymentTerms: useCredit ? "credit_60" : "prepaid",
          subtotal: subtotal.toFixed(2),
          taxAmount: tax.toFixed(2),
          totalAmount: total.toFixed(2),
          expectedDelivery: "2026-06-25",
          createdBy: DEMO_USER_ID,
        })
        .returning();

      for (const r of poItemRows) {
        await db.insert(poItems).values({
          organizationId: org.id,
          purchaseOrderId: po.id,
          productId: r.it.productId,
          description: r.it.desc,
          quantity: String(r.it.qty),
          unit: r.it.unit,
          unitPrice: r.it.unitPrice.toFixed(2),
          gstRate: String(r.it.gst),
          lineTotal: (r.line + r.lineTax).toFixed(2),
        });
      }

      await db.insert(deliveries).values({
        organizationId: org.id,
        purchaseOrderId: po.id,
        status: delivered ? "delivered" : "scheduled",
        eta: "2026-06-25",
        deliveredAt: delivered ? new Date("2026-06-15") : null,
        grnConfirmed: delivered,
      });

      await db.insert(invoices).values({
        organizationId: org.id,
        purchaseOrderId: po.id,
        invoiceNumber: `INV-${invSeq++}`,
        amount: total.toFixed(2),
        status: delivered ? "paid" : "issued",
        dueDate: "2026-08-14",
        paidAt: delivered ? new Date("2026-06-16") : null,
      });
    }
  }

  console.log(`✅ Seed complete:
   ${brandRows.length} brands
   ${CATEGORIES.length} categories
   ${productCount} products / ${priceCount} price tiers
   1 demo org (${org.name}) with ${projectSeeds.length} projects`);

  await client.end();
}

main().catch(async (e) => {
  console.error("❌ Seed failed:", e);
  await client.end();
  process.exit(1);
});
