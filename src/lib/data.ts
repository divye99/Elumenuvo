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
};

export const PRODUCTS: Product[] = [
  { id: "poly25",   brand: "Polycab",   name: "FRLS Wire 2.5 mm²",       spec: "90 m coil · 1100 V · red",  sku: "POLY-FRLS-2.5", cat: "Wires & Cables", price: 1842, market: 1995, unit: "coil" },
  { id: "hav32",    brand: "Havells",   name: "DP MCB 32A 'C' curve",    spec: "10 kA · 2-pole · BIS",      sku: "HAV-MCB-32C",   cat: "Switchgear",     price: 486,  market: 540,  unit: "pc" },
  { id: "schrccb",  brand: "Schneider", name: "Acti9 RCCB 40A 30mA",     spec: "4-pole · Type AC",          sku: "SCH-A9-RCCB40", cat: "Switchgear",     price: 2180, market: 2460, unit: "pc" },
  { id: "leg1w",    brand: "Legrand",   name: "Myrius 1-way Switch 16A", spec: "Modular · white",           sku: "LEG-MYR-1W16",  cat: "Modular",        price: 128,  market: 148,  unit: "pc" },
  { id: "crmfan",   brand: "Crompton",  name: "Hill Briz 1200mm Fan",    spec: "BLDC · 28 W · brown",       sku: "CRM-HB-1200",   cat: "Fans",           price: 1640, market: 1820, unit: "pc" },
  { id: "finfr4",   brand: "Finolex",   name: "FR Wire 4 mm²",           spec: "90 m coil · 1100 V",        sku: "FIN-FR-4.0",    cat: "Wires & Cables", price: 2910, market: 3150, unit: "coil" },
  { id: "abbdb8",   brand: "ABB",       name: "8-way DB · SPN",          spec: "IP43 · double door",        sku: "ABB-DB-8SPN",   cat: "DB & Panels",    price: 1420, market: 1610, unit: "pc" },
  { id: "sysled",   brand: "Syska",     name: "LED Bulb 9W (pack of 4)", spec: "6500 K · B22",              sku: "SYS-LED-9",     cat: "Lighting",       price: 540,  market: 620,  unit: "pack" },
  { id: "ancroma",  brand: "Anchor",    name: "Roma 6A Socket",          spec: "Modular · 2/3-pin",         sku: "ANC-ROMA-6",    cat: "Modular",        price: 96,   market: 112,  unit: "pc" },
  { id: "poly15",   brand: "Polycab",   name: "FRLS Wire 1.5 mm²",       spec: "90 m coil · 1100 V · blue", sku: "POLY-FRLS-1.5", cat: "Wires & Cables", price: 1180, market: 1290, unit: "coil" },
  { id: "havpanel", brand: "Havells",   name: "LED Panel 18W · DW",      spec: "Recessed · square",         sku: "HAV-LED-18",    cat: "Lighting",       price: 420,  market: 485,  unit: "pc" },
  { id: "schliv",   brand: "Schneider", name: "Livia 2M Socket",         spec: "16A · modular",             sku: "SCH-LIV-2M",    cat: "Modular",        price: 210,  market: 240,  unit: "pc" },
];

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

export const CATS = ["All", "Wires & Cables", "Switchgear", "Modular", "DB & Panels", "Fans", "Lighting"];

export const HOME_CATS = ["All", "Wires & Cables", "Switchgear", "Modular", "Lighting", "Fans", "DB & Panels"];

export const HERO_CATS = ["Wires & Cables", "Switchgear", "Lighting", "Fans", "Modular", "DB & Panels"];

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

export const HOME_BRANDS = ["Havells", "Polycab", "Crompton", "Schneider", "Legrand", "ABB", "Finolex", "Anchor"];

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
