// Catalogue + sample data — ported 1:1 from the Elume prototype.

export type Product = {
  id: string;
  brand: string;
  name: string;
  spec: string;
  sku: string;
  cat: string;
  price: number;
  market: number;
  unit: string;
  image?: string;
  /** Avg star rating (1–5) from customer reviews; undefined until reviewed. */
  rating?: number;
  ratingCount?: number;
  /** Sort signals (Supabase-managed; default 0/false for static fallback). */
  unitsSold?: number;
  recommended?: boolean;
  /** Lowest buyable competitor price across APPROVED mappings (maintained by
   *  refresh_market_low in the DB). Undefined = no trusted competitor price. */
  marketLow?: number;
  /** Variant family — variations point at their parent product via parentId
   *  (null/undefined = parent or standalone). Family = parent + children. */
  parentId?: string;
  attrs?: Record<string, string>;
  /** Structured technical data from the manufacturer catalogue (wires today). */
  techSpecs?: TechSpecs;
};

export type TechSpecs = {
  line?: string;
  conductor?: { material?: string; class?: string; strands?: string; resistance_ohm_km?: number };
  insulation?: { material?: string; thickness_mm?: number };
  dimensions?: { overall_diameter_mm?: number };
  current_rating_a?: { min?: number; max?: number; raw?: number[] };
  max_operating_temp_c?: number;
  voltage_grade_v?: number;
  standards?: string[];
  fire_tests?: { test: string; method: string; value: string }[];
  packing?: string;
  colours?: string[];
  source?: string;
  // Generic manufacturer data (brand-site imports, e.g. havells.com): a short
  // description, the PDP's Key Features bullets, feature cards (title + body)
  // and the spec table as plain key/value rows. Wires use the structured
  // fields above instead; a product may carry either shape (or both).
  description?: string;
  key_features?: string[];
  features?: { title: string; body: string }[];
  specs?: Record<string, string>;
};

// The catalogue lives in Supabase (public.products) — no static copy here.
// See supabase/migrations/0002_catalogue-v2.sql for schema + seed.


export type ShowcaseItem = {
  brand: string;
  name: string;
  spec: string;
  sku: string;
  cat: string;
  price: number;
  market: number;
  tile: string;
};

// Landing catalogue showcase — exact list/tiles from Elume Home.dc.html.
export const HOME_CATALOGUE: ShowcaseItem[] = [
  { brand: "Polycab",   name: "FRLS Wire 2.5 mm²",       spec: "90 m coil · 1100 V", sku: "POLY-FRLS-2.5", cat: "Wires & Cables", price: 1842, market: 1995, tile: "linear-gradient(135deg,#FBE9E4,#F6D9CF)" },
  { brand: "Havells",   name: "DP MCB 32A 'C' curve",    spec: "10 kA · 2-pole",     sku: "HAV-MCB-32C",   cat: "Switchgear",     price: 486,  market: 540,  tile: "linear-gradient(135deg,#E7ECFB,#D7E0F6)" },
  { brand: "Schneider", name: "Acti9 RCCB 40A 30mA",     spec: "4-pole · Type AC",   sku: "SCH-A9-RCCB40", cat: "Switchgear",     price: 2180, market: 2460, tile: "linear-gradient(135deg,#E4F3EC,#D2EADD)" },
  { brand: "Crompton",  name: "Hill Briz 1200mm Fan",    spec: "BLDC · 28 W",        sku: "CRM-HB-1200",   cat: "Fans",           price: 1640, market: 1820, tile: "linear-gradient(135deg,#F3ECFB,#E6D9F6)" },
  { brand: "Legrand",   name: "Myrius 1-way Switch 16A", spec: "Modular · white",    sku: "LEG-MYR-1W16",  cat: "Modular",        price: 128,  market: 148,  tile: "linear-gradient(135deg,#FBF4E4,#F6EBCF)" },
  { brand: "ABB",       name: "8-way DB · SPN",          spec: "IP43 · double door", sku: "ABB-DB-8SPN",   cat: "DB & Panels",    price: 1420, market: 1610, tile: "linear-gradient(135deg,#E7ECFB,#D9E2F4)" },
  { brand: "Havells",   name: "LED Panel 18W · DW",      spec: "Recessed · square",  sku: "HAV-LED-18",    cat: "Lighting",       price: 420,  market: 485,  tile: "linear-gradient(135deg,#E4F3EC,#D4ECDF)" },
  { brand: "Finolex",   name: "FR Wire 4 mm²",           spec: "90 m coil · 1100 V", sku: "FIN-FR-4.0",    cat: "Wires & Cables", price: 2910, market: 3150, tile: "linear-gradient(135deg,#FBE9E4,#F4D6CB)" },
  { brand: "Polycab",   name: "FRLS Wire 1.5 mm²",       spec: "90 m coil · blue",   sku: "POLY-FRLS-1.5", cat: "Wires & Cables", price: 1180, market: 1290, tile: "linear-gradient(135deg,#FBE9E4,#F2D2C6)" },
  { brand: "Anchor",    name: "Roma 6A Socket",          spec: "Modular · 2/3-pin",  sku: "ANC-ROMA-6",    cat: "Modular",        price: 96,   market: 112,  tile: "linear-gradient(135deg,#FBF4E4,#F4EBCC)" },
  { brand: "Syska",     name: "LED Bulb 9W · pack of 4", spec: "6500 K · B22",       sku: "SYS-LED-9",     cat: "Lighting",       price: 540,  market: 620,  tile: "linear-gradient(135deg,#E4F3EC,#D4ECDF)" },
  { brand: "Crompton",  name: "Energion 1200mm Fan",     spec: "BLDC · 35 W · remote", sku: "CRM-EN-1200", cat: "Fans",           price: 2480, market: 2780, tile: "linear-gradient(135deg,#F3ECFB,#E6D9F6)" },
];

export const CATS = ["All", "Wires & Cables", "Switchgear", "Modular", "DB & Panels", "Fans", "Lighting", "Pumps", "Electrical Accessories", "EV Charging"];

export const HOME_CATS = ["All", "Wires & Cables", "Switchgear", "Modular", "Lighting", "Fans", "DB & Panels", "Pumps", "Electrical Accessories", "EV Charging"];

export const HERO_CATS = ["Wires & Cables", "Switchgear", "Lighting", "Fans", "Modular", "DB & Panels"];

/** Every browsable category with its menu icon — one source for the desktop
 *  mega-menu and the mobile drawer, so they always show the same thing. */
export const MENU_CATS: [string, string][] = [
  ["Wires & Cables", "〰️"],
  ["Switchgear", "⚡"],
  ["Modular", "▣"],
  ["Lighting", "💡"],
  ["Fans", "🌀"],
  ["DB & Panels", "🗄️"],
  ["Pumps", "🚰"],
  ["Electrical Accessories", "🔌"],
  ["EV Charging", "🔋"],
];

export const FEATURE_TAGS = [
  "Every brand, one cart",
  "See savings per line",
  "Auto-PO by stage",
  "30-day NBFC credit",
];

export type HomeChartSeries = {
  brand: string;
  name: string;
  unit: string;
  s0: number;
  s1: number;
  market: number[];
};

// 12-month market series for the landing pricing engine (Jul'25 → Jun'26).
export const HOMECHART: Record<string, HomeChartSeries> = {
  poly25:   { brand: "Polycab",   name: "FRLS Wire 2.5 mm²",   unit: "/coil", s0: 0.045, s1: 0.0767, market: [1820, 1880, 1960, 2040, 1980, 1940, 2010, 2090, 2150, 2090, 2030, 1995] },
  schrccb:  { brand: "Schneider", name: "Acti9 RCCB 40A 30mA", unit: "/pc",   s0: 0.05,  s1: 0.1138, market: [2360, 2380, 2400, 2420, 2410, 2430, 2450, 2470, 2460, 2455, 2460, 2460] },
  crmfan:   { brand: "Crompton",  name: "Hill Briz 1200mm Fan", unit: "/pc",  s0: 0.05,  s1: 0.0989, market: [1880, 1875, 1862, 1852, 1846, 1840, 1836, 1832, 1828, 1822, 1818, 1820] },
  abbdb8:   { brand: "ABB",       name: "8-way DB · SPN",      unit: "/pc",   s0: 0.045, s1: 0.118,  market: [1520, 1560, 1610, 1640, 1600, 1570, 1590, 1630, 1660, 1630, 1605, 1610] },
  havpanel: { brand: "Havells",   name: "LED Panel 18W · DW",  unit: "/pc",   s0: 0.05,  s1: 0.134,  market: [560, 548, 540, 532, 520, 512, 505, 498, 492, 488, 485, 485] },
};

export const AUTOPO: { id: string; qty: number }[] = [
  { id: "schrccb", qty: 160 },
  { id: "hav32", qty: 420 },
  { id: "abbdb8", qty: 120 },
  { id: "leg1w", qty: 930 },
];

// Category → gradient tile (empty-state product image background).
export function tileFor(cat: string): string {
  const m: Record<string, string> = {
    "Wires & Cables": "linear-gradient(135deg,#FBE9E4,#F4D6CB)",
    Switchgear: "linear-gradient(135deg,#E7ECFB,#D7E0F6)",
    Modular: "linear-gradient(135deg,#FBF4E4,#F4EBCC)",
    Lighting: "linear-gradient(135deg,#E4F3EC,#D2EADD)",
    Fans: "linear-gradient(135deg,#F3ECFB,#E6D9F6)",
    "DB & Panels": "linear-gradient(135deg,#E7ECFB,#D9E2F4)",
  };
  return m[cat] || "linear-gradient(135deg,#F1F3F8,#E6E9F1)";
}

export const HOME_BRANDS = ["Havells", "Polycab", "Atomberg", "Norisys", "Crompton", "Schneider", "Legrand", "ABB", "Finolex", "Anchor"];

export const STEPS = [
  { n: "1", kicker: "Plan", title: "Build the BOM", body: "Upload your BOQ or build it from the catalogue. Smart BOM matches and flags every line." },
  { n: "2", kicker: "Source & price", title: "Compare & lock", body: "See every brand priced against market. Pick on spec, stock and landed cost." },
  { n: "3", kicker: "Order & finance", title: "Release with credit", body: "POs auto-release by stage. Pay on delivery or take 30-day credit — your call." },
  { n: "4", kicker: "Receive & manage", title: "Track to site", body: "Live tracking, GRN on arrival, and a portfolio view across all your sites." },
];

export const MINI_ROWS = [
  { name: "Aurelia Towers", loc: "Noida · Sec 150", tag: "PO due", bg: "#FBF1E0", fg: "#C5841C" },
  { name: "Greenscape Residency", loc: "Ghaziabad", tag: "On track", bg: "#E6F5EE", fg: "#1F9D63" },
  { name: "Meadows Phase 2", loc: "Gr. Noida West", tag: "Reorder", bg: "#EEF0FD", fg: "#4E5BDC" },
];

/* ── Dashboard sample data (illustrative; becomes real per-user data with auth) ── */
export type ProjectRow = { name: string; loc: string; stage: string; committed: string; pct: string; credit: string; action: string; kind: string };
export const PROJECTS: ProjectRow[] = [
  { name: "Aurelia Towers", loc: "Noida · Sec 150", stage: "Wiring", committed: "₹64.0L", pct: "72", credit: "₹18.0L · 28d", action: "PO due · Switchgear", kind: "warn" },
  { name: "Greenscape Residency", loc: "Ghaziabad · Raj Nagar Ext", stage: "Panel & DB", committed: "₹41.2L", pct: "55", credit: "₹9.0L · 41d", action: "On track", kind: "ok" },
  { name: "Meadows Phase 2", loc: "Gr. Noida West", stage: "Finishing", committed: "₹78.5L", pct: "88", credit: "₹14.0L · 12d", action: "Reorder · Fans", kind: "info" },
  { name: "Civic Square Mall", loc: "Meerut · Shastri Nagar", stage: "Rough-in", committed: "₹52.0L", pct: "31", credit: "₹6.0L · 60d", action: "BOM review", kind: "warn" },
  { name: "Riverside Heights", loc: "Noida · Sec 137", stage: "Finishing", committed: "₹39.0L", pct: "94", credit: "₹5.0L · 4d", action: "Closing", kind: "mute" },
  { name: "Lotus Enclave", loc: "Gr. Noida · Sec 1", stage: "Wiring", committed: "₹27.8L", pct: "48", credit: "₹7.0L · 33d", action: "On track", kind: "ok" },
];

export const STAGES = [
  { label: "Rough-in", value: "₹6.2L", tag: "Delivered", kind: "done", lineL: "transparent", lineR: "#1F9D63" },
  { label: "Wiring", value: "₹11.4L", tag: "Active · Jun", kind: "active", lineL: "#1F9D63", lineR: "#cfd5e2" },
  { label: "Panel & DB", value: "₹8.4L", tag: "Releases Jul 2", kind: "due", lineL: "#cfd5e2", lineR: "#E8EBF1" },
  { label: "Finishing", value: "₹14.0L", tag: "Scheduled Aug", kind: "next", lineL: "#E8EBF1", lineR: "transparent" },
];

export const BOM_ROWS = [
  { name: "FRLS Wire 2.5 mm² · red", sku: "POLY-FRLS-2.5", brand: "Polycab", stage: "Wiring", qty: "180 coil", total: "₹3.32L" },
  { name: "FRLS Wire 1.5 mm² · blue", sku: "POLY-FRLS-1.5", brand: "Polycab", stage: "Wiring", qty: "120 coil", total: "₹1.42L" },
  { name: "DP MCB 32A 'C'", sku: "HAV-MCB-32C", brand: "Havells", stage: "Panel & DB", qty: "420 pc", total: "₹2.04L" },
  { name: "Acti9 RCCB 40A 30mA", sku: "SCH-A9-RCCB40", brand: "Schneider", stage: "Panel & DB", qty: "160 pc", total: "₹3.49L" },
  { name: "8-way DB · SPN", sku: "ABB-DB-8SPN", brand: "ABB", stage: "Panel & DB", qty: "120 pc", total: "₹1.70L" },
];

export const PARSED_ROWS = [
  { raw: "2.5sqmm FR red wire", match: "Polycab FRLS Wire 2.5 mm²", sku: "POLY-FRLS-2.5", qty: "180 coil", price: "₹3.32L" },
  { raw: "MCB 32amp DP", match: "Havells DP MCB 32A 'C'", sku: "HAV-MCB-32C", qty: "420 pc", price: "₹2.04L" },
  { raw: "RCCB 40A 30ma 4p", match: "Schneider Acti9 RCCB 40A", sku: "SCH-A9-RCCB40", qty: "160 pc", price: "₹3.49L" },
  { raw: "dist board 8way", match: "ABB 8-way DB · SPN", sku: "ABB-DB-8SPN", qty: "120 pc", price: "₹1.70L" },
  { raw: "1200 ceiling fan", match: "Crompton Hill Briz 1200mm", sku: "CRM-HB-1200", qty: "96 pc", price: "₹1.57L" },
];

export const TRACK_STEPS = [
  { label: "Confirmed", sub: "Today, 10:24", kind: "done", lineL: "transparent", lineR: "#1F9D63" },
  { label: "Dispatched", sub: "Tomorrow", kind: "active", lineL: "#1F9D63", lineR: "#cfd5e2" },
  { label: "Out for delivery", sub: "Wed", kind: "next", lineL: "#cfd5e2", lineR: "#E8EBF1" },
  { label: "Delivered", sub: "ETA Thu", kind: "next", lineL: "#E8EBF1", lineR: "transparent" },
];
