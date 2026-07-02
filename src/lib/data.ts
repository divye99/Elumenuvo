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

  // ── CMI WIRES & CABLES · GreenShield single-core copper house wires (90 m coil) ──
  // From the CMI Amazon brand store: price = store price, market = MRP.
  { id: "cmi-gs-10-red", brand: "CMI", name: "GreenShield House Wire 1.0 sq mm — Red",    spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.0-RED", cat: "Wires & Cables", price: 1659, market: 3000, unit: "coil" },
  { id: "cmi-gs-15-red", brand: "CMI", name: "GreenShield House Wire 1.5 sq mm — Red",    spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.5-RED", cat: "Wires & Cables", price: 2426, market: 4480, unit: "coil" },
  { id: "cmi-gs-25-red", brand: "CMI", name: "GreenShield House Wire 2.5 sq mm — Red",    spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-2.5-RED", cat: "Wires & Cables", price: 3840, market: 6080, unit: "coil" },
  { id: "cmi-gs-10-blu", brand: "CMI", name: "GreenShield House Wire 1.0 sq mm — Blue",   spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.0-BLU", cat: "Wires & Cables", price: 1659, market: 3000, unit: "coil" },
  { id: "cmi-gs-15-blu", brand: "CMI", name: "GreenShield House Wire 1.5 sq mm — Blue",   spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.5-BLU", cat: "Wires & Cables", price: 2426, market: 4480, unit: "coil" },
  { id: "cmi-gs-25-blu", brand: "CMI", name: "GreenShield House Wire 2.5 sq mm — Blue",   spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-2.5-BLU", cat: "Wires & Cables", price: 3840, market: 6080, unit: "coil" },
  { id: "cmi-gs-10-blk", brand: "CMI", name: "GreenShield House Wire 1.0 sq mm — Black",  spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.0-BLK", cat: "Wires & Cables", price: 1659, market: 3000, unit: "coil" },
  { id: "cmi-gs-15-blk", brand: "CMI", name: "GreenShield House Wire 1.5 sq mm — Black",  spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.5-BLK", cat: "Wires & Cables", price: 2426, market: 4480, unit: "coil" },
  { id: "cmi-gs-25-blk", brand: "CMI", name: "GreenShield House Wire 2.5 sq mm — Black",  spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-2.5-BLK", cat: "Wires & Cables", price: 3840, market: 6080, unit: "coil" },
  { id: "cmi-gs-10-yel", brand: "CMI", name: "GreenShield House Wire 1.0 sq mm — Yellow", spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.0-YEL", cat: "Wires & Cables", price: 1659, market: 3000, unit: "coil" },
  { id: "cmi-gs-15-yel", brand: "CMI", name: "GreenShield House Wire 1.5 sq mm — Yellow", spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-1.5-YEL", cat: "Wires & Cables", price: 2426, market: 4480, unit: "coil" },
  { id: "cmi-gs-25-yel", brand: "CMI", name: "GreenShield House Wire 2.5 sq mm — Yellow", spec: "90 m coil · single-core copper · FR PVC · 10-yr warranty", sku: "CMI-GS-2.5-YEL", cat: "Wires & Cables", price: 4249, market: 7000, unit: "coil" },
  // ── Catalogue expansion (mirrors supabase/catalogue-additions.sql) ──
  { id: "kei-fr-15", brand: "KEI", name: "Conflame FR Wire 1.5 sq mm", spec: "90 m coil · single-core copper · 1100 V", sku: "KEI-FR-1.5", cat: "Wires & Cables", price: 1290, market: 2149, unit: "coil" },
  { id: "kei-fr-25", brand: "KEI", name: "Conflame FR Wire 2.5 sq mm", spec: "90 m coil · single-core copper · 1100 V", sku: "KEI-FR-2.5", cat: "Wires & Cables", price: 2100, market: 3499, unit: "coil" },
  { id: "rr-fr-15", brand: "RR Kabel", name: "Superex FR Wire 1.5 sq mm", spec: "90 m coil · single-core copper · HR PVC", sku: "RR-SFR-1.5", cat: "Wires & Cables", price: 1350, market: 2260, unit: "coil" },
  { id: "rr-fr-25", brand: "RR Kabel", name: "Superex FR Wire 2.5 sq mm", spec: "90 m coil · single-core copper · HR PVC", sku: "RR-SFR-2.5", cat: "Wires & Cables", price: 2230, market: 3690, unit: "coil" },
  { id: "hav-ll-15", brand: "Havells", name: "Life Line FR Wire 1.5 sq mm", spec: "90 m coil · single-core copper · FR PVC", sku: "HAV-LL-1.5", cat: "Wires & Cables", price: 1420, market: 2249, unit: "coil" },
  { id: "hav-ll-25", brand: "Havells", name: "Life Line FR Wire 2.5 sq mm", spec: "90 m coil · single-core copper · FR PVC", sku: "HAV-LL-2.5", cat: "Wires & Cables", price: 2350, market: 3699, unit: "coil" },
  { id: "fin-fr-10", brand: "Finolex", name: "FR Wire 1.0 sq mm", spec: "90 m coil · single-core copper · 1100 V", sku: "FIN-FR-1.0", cat: "Wires & Cables", price: 999, market: 1539, unit: "coil" },
  { id: "poly-fr-60", brand: "Polycab", name: "FRLS Wire 6.0 sq mm", spec: "90 m coil · single-core copper · 1100 V", sku: "POLY-FR-6.0", cat: "Wires & Cables", price: 4480, market: 6999, unit: "coil" },
  { id: "poly-flex-3c15", brand: "Polycab", name: "Flexible Cable 3-core 1.5 sq mm", spec: "100 m · round sheathed · copper", sku: "POLY-FLX-3C1.5", cat: "Wires & Cables", price: 4340, market: 6200, unit: "coil" },
  { id: "hav-mcb-6b", brand: "Havells", name: "SP MCB 6A 'B' curve", spec: "10 kA · 1-pole · IS/IEC 60898", sku: "HAV-MCB-6B", cat: "Switchgear", price: 132, market: 190, unit: "pc" },
  { id: "hav-mcb-16c", brand: "Havells", name: "SP MCB 16A 'C' curve", spec: "10 kA · 1-pole · IS/IEC 60898", sku: "HAV-MCB-16C", cat: "Switchgear", price: 142, market: 205, unit: "pc" },
  { id: "hav-mcb-32c-sp", brand: "Havells", name: "SP MCB 32A 'C' curve", spec: "10 kA · 1-pole · IS/IEC 60898", sku: "HAV-MCB-32C-SP", cat: "Switchgear", price: 149, market: 215, unit: "pc" },
  { id: "sch-mcb-32", brand: "Schneider", name: "Acti9 SP MCB 32A", spec: "10 kA · 1-pole · C curve", sku: "SCH-A9-MCB32", cat: "Switchgear", price: 218, market: 302, unit: "pc" },
  { id: "leg-mcb-16", brand: "Legrand", name: "DX3 SP MCB 16A", spec: "10 kA · 1-pole · C curve", sku: "LEG-DX3-16C", cat: "Switchgear", price: 188, market: 268, unit: "pc" },
  { id: "abb-mcb-10", brand: "ABB", name: "SP MCB 10A", spec: "10 kA · 1-pole · C curve", sku: "ABB-SB201-10", cat: "Switchgear", price: 158, market: 226, unit: "pc" },
  { id: "anc-mcb-16", brand: "Anchor", name: "UNO SP MCB 16A", spec: "6 kA · 1-pole · C curve", sku: "ANC-UNO-16C", cat: "Switchgear", price: 99, market: 145, unit: "pc" },
  { id: "hav-rccb-40", brand: "Havells", name: "RCCB 40A 30mA DP", spec: "2-pole · Type AC", sku: "HAV-RCCB-40DP", cat: "Switchgear", price: 1490, market: 2100, unit: "pc" },
  { id: "leg-rccb-63", brand: "Legrand", name: "RCCB 63A 30mA 4P", spec: "4-pole · Type AC", sku: "LEG-RCCB-63-4P", cat: "Switchgear", price: 3420, market: 4980, unit: "pc" },
  { id: "hav-iso-40", brand: "Havells", name: "DP Isolator 40A", spec: "2-pole · switch disconnector", sku: "HAV-ISO-40DP", cat: "Switchgear", price: 335, market: 480, unit: "pc" },
  { id: "anc-roma-16sw", brand: "Anchor", name: "Roma 16A 1-way Switch", spec: "Modular · white · urea back", sku: "ANC-ROMA-16SW", cat: "Modular", price: 105, market: 155, unit: "pc" },
  { id: "anc-roma-2w6", brand: "Anchor", name: "Roma 6A 2-way Switch", spec: "Modular · white", sku: "ANC-ROMA-2W6", cat: "Modular", price: 63, market: 92, unit: "pc" },
  { id: "anc-roma-reg", brand: "Anchor", name: "Roma Fan Regulator", spec: "Modular · 5-step · EME", sku: "ANC-ROMA-REG", cat: "Modular", price: 340, market: 495, unit: "pc" },
  { id: "anc-roma-2m", brand: "Anchor", name: "Roma 2M Cover Plate", spec: "Modular · white", sku: "ANC-ROMA-2MPL", cat: "Modular", price: 45, market: 65, unit: "pc" },
  { id: "leg-myr-6s", brand: "Legrand", name: "Myrius 6A Socket", spec: "Modular · 2/3-pin · shuttered", sku: "LEG-MYR-6S", cat: "Modular", price: 95, market: 135, unit: "pc" },
  { id: "leg-myr-16s", brand: "Legrand", name: "Myrius 16A Socket", spec: "Modular · 6-pin · shuttered", sku: "LEG-MYR-16S", cat: "Modular", price: 168, market: 240, unit: "pc" },
  { id: "gm-gera-1w", brand: "GM Modular", name: "G-Era 6A 1-way Switch", spec: "Modular · white", sku: "GM-GERA-1W6", cat: "Modular", price: 54, market: 78, unit: "pc" },
  { id: "hav-coral-6", brand: "Havells", name: "Coral 6A 1-way Switch", spec: "Modular · white", sku: "HAV-CORAL-6SW", cat: "Modular", price: 38, market: 55, unit: "pc" },
  { id: "sch-liv-6sw", brand: "Schneider", name: "Livia 6A 1-way Switch", spec: "Modular · white", sku: "SCH-LIV-6SW", cat: "Modular", price: 61, market: 88, unit: "pc" },
  { id: "phi-led-9x2", brand: "Philips", name: "9W LED Bulb B22 (pack of 2)", spec: "6500 K · cool daylight", sku: "PHI-LED-9X2", cat: "Lighting", price: 315, market: 499, unit: "pack" },
  { id: "crm-led-10", brand: "Crompton", name: "10W LED Bulb B22", spec: "6500 K · high lumen", sku: "CRM-LED-10", cat: "Lighting", price: 199, market: 349, unit: "pc" },
  { id: "wip-bat-20", brand: "Wipro", name: "Garnet 20W LED Batten 4ft", spec: "6500 K · slim profile", sku: "WIP-GAR-20", cat: "Lighting", price: 385, market: 599, unit: "pc" },
  { id: "sys-bat-20", brand: "Syska", name: "20W LED Batten 4ft", spec: "6500 K · polycarbonate", sku: "SYS-BAT-20", cat: "Lighting", price: 355, market: 550, unit: "pc" },
  { id: "hav-pnl-15r", brand: "Havells", name: "15W LED Panel · Round", spec: "Recessed · 6500 K", sku: "HAV-PNL-15R", cat: "Lighting", price: 470, market: 750, unit: "pc" },
  { id: "sys-fld-30", brand: "Syska", name: "30W LED Flood Light", spec: "IP66 · 6500 K", sku: "SYS-FLD-30", cat: "Lighting", price: 940, market: 1499, unit: "pc" },
  { id: "phi-str-24", brand: "Philips", name: "24W LED Street Light", spec: "IP65 · 6500 K · driver on board", sku: "PHI-STR-24", cat: "Lighting", price: 1690, market: 2450, unit: "pc" },
  { id: "atm-ren-1200", brand: "Atomberg", name: "Renesa 1200mm BLDC Fan", spec: "BLDC · 28 W · remote · 5-star", sku: "ATM-REN-1200", cat: "Fans", price: 3290, market: 4700, unit: "pc" },
  { id: "hav-amb-1200", brand: "Havells", name: "Ambrose 1200mm Fan", spec: "Decorative · premium finish", sku: "HAV-AMB-1200", cat: "Fans", price: 3230, market: 4870, unit: "pc" },
  { id: "usha-racer-1200", brand: "Usha", name: "Racer 1200mm Fan", spec: "High speed · 400 RPM", sku: "USHA-RACER-1200", cat: "Fans", price: 1780, market: 2570, unit: "pc" },
  { id: "ori-aero-1200", brand: "Orient", name: "Aeroquiet 1200mm Fan", spec: "Silent aerodynamic · 18-pole motor", sku: "ORI-AERO-1200", cat: "Fans", price: 3950, market: 5730, unit: "pc" },
  { id: "crm-exh-250", brand: "Crompton", name: "Brizair 250mm Exhaust Fan", spec: "High air delivery · white", sku: "CRM-BRIZ-250", cat: "Fans", price: 1230, market: 1850, unit: "pc" },
  { id: "hav-vent-230", brand: "Havells", name: "Ventilair 230mm Exhaust Fan", spec: "DSP · grey", sku: "HAV-VENT-230", cat: "Fans", price: 1440, market: 2145, unit: "pc" },
  { id: "hav-db-8spn", brand: "Havells", name: "8-way SPN DB · Double Door", spec: "IP43 · CRCA steel · powder coated", sku: "HAV-DB-8SPN", cat: "DB & Panels", price: 1160, market: 1720, unit: "pc" },
  { id: "leg-db-12spn", brand: "Legrand", name: "Ekinoxe 12-way SPN DB", spec: "IP43 · double door", sku: "LEG-EKX-12SPN", cat: "DB & Panels", price: 1690, market: 2480, unit: "pc" },
  { id: "abb-db-4spn", brand: "ABB", name: "4-way SPN DB", spec: "IP43 · single door", sku: "ABB-DB-4SPN", cat: "DB & Panels", price: 690, market: 980, unit: "pc" },
  { id: "sch-db-8tpn", brand: "Schneider", name: "Easy9 8-way TPN DB", spec: "IP43 · double door", sku: "SCH-E9-8TPN", cat: "DB & Panels", price: 2980, market: 4350, unit: "pc" },
  { id: "hav-db-6tpn", brand: "Havells", name: "6-way TPN DB · Double Door", spec: "IP43 · CRCA steel", sku: "HAV-DB-6TPN", cat: "DB & Panels", price: 2320, market: 3390, unit: "pc" },
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
