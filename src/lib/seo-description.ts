import type { Product } from "@/lib/data";
import { isMetalCategory, lotKg } from "@/lib/metals";
import { gstRateFor } from "@/lib/pricing";

/**
 * Product descriptions for search engines and Google Merchant Center.
 *
 * Merchant Center reads the page's meta description / Product JSON-LD and
 * checks it for the attributes shoppers filter by. Its extractor is literal:
 * Havells' own phrasing ("No. of Blades 3 N", "Sweep Size 1200 mm") is NOT
 * recognised as a blade count or a fan size, which is why 147 fans were
 * flagged "add Number of Blades / Fan Size" even though most pages carried
 * both. This module rewrites the facts we already hold in plain retail
 * wording: "1200 mm (48 inch) ceiling fan with 3 blades".
 *
 * Facts come from tech_specs/attrs/name ONLY - nothing is invented. A missing
 * fact is simply omitted.
 */

const num = (v: unknown): string | null => {
  const m = String(v ?? "").match(/[\d.]+/);
  return m ? m[0] : null;
};

/** "1200 mm" -> the trade's inch label (48"), because shoppers search both. */
const MM_TO_INCH: Record<string, string> = { "600": "24", "900": "36", "1050": "42", "1200": "48", "1320": "52", "1400": "56" };

function spec(p: Product, key: string): string | null {
  const s = (p.techSpecs as { specs?: Record<string, string> } | undefined)?.specs;
  const v = s?.[key];
  return v ? String(v) : null;
}

/** Fan-specific sentence with the fields Merchant Center asks for. */
function fanDescription(p: Product): string {
  const bits: string[] = [];

  const sweep = num(spec(p, "Sweep Size") ?? (p.attrs as Record<string, string> | undefined)?.["Sweep"] ?? p.name.match(/\d{3,4}\s*mm/)?.[0]);
  const kind = /exhaust|ventilation/i.test(p.name) ? "exhaust fan"
    : /table fan/i.test(p.name) ? "table fan"
    : /pedestal/i.test(p.name) ? "pedestal fan"
    : /wall fan/i.test(p.name) ? "wall fan"
    : "ceiling fan";
  if (sweep) {
    const inch = MM_TO_INCH[sweep];
    bits.push(`${sweep} mm${inch ? ` (${inch} inch)` : ""} fan size`);
  }

  const blades = num(spec(p, "No. of Blades"));
  if (blades) bits.push(`${blades} blades`);

  const motor = spec(p, "Motor Type");
  if (motor) bits.push(/bldc/i.test(motor) ? "energy-saving BLDC motor" : `${motor.replace(/ motor/i, "")} motor`);

  const rpm = num(spec(p, "Rated Speed") ?? spec(p, "RPM"));
  if (rpm) bits.push(`${rpm} RPM`);

  const air = num(spec(p, "Air Delivery"));
  if (air) bits.push(`${air} m³/min air delivery`);

  const watts = num(spec(p, "Power Consumption") ?? spec(p, "Wattage") ?? spec(p, "Power"));
  if (watts) bits.push(`${watts} W`);

  const star = num(spec(p, "Star Rating"));
  if (star) bits.push(`${star} star rated`);

  const remote = spec(p, "Remote Control Option");
  if (remote && /yes/i.test(remote)) bits.push("with remote control");

  const warranty = spec(p, "Warranty") ?? spec(p, "Guarantee");
  if (warranty && num(warranty)) bits.push(`${num(warranty)} year warranty`);

  const colour = (p.attrs as Record<string, string> | undefined)?.["Colour"];
  const head = `${p.name} by ${p.brand}: ${colour ? `${colour.toLowerCase()} ` : ""}${kind}${bits.length ? ` with ${bits[0]}` : ""}`;
  return `${head}${bits.length > 1 ? `, ${bits.slice(1).join(", ")}` : ""}.`;
}


/** Finish names that appear in our lighting/fan product names. Order matters:
 *  longest first so "Matt Black" wins over "Black". */
const FINISHES = ["Matt Gold","Matt GLD","Matt Black","Matt White","Matt Blue","Antique Brass","Rose Gold","Brushed Nickel","Antique Copper","Pearl White","Glossy Chrome","Matt Chrome","Champagne","Chrome","Gold","Black","White","Silver","Grey","Brown","Blue","Copper","Brass"];

function finishFromName(name: string): string | null {
  const hit = FINISHES.find((f) => new RegExp(`\\b${f}\\b`, "i").test(name.replace(/\bGLD\b/g, "Gold").replace(/\bABR\b/g, "Antique Brass")));
  if (!hit) return null;
  return hit.replace(/\bGLD\b/, "Gold");
}

/** Broad colour family Google groups shades into (gold tones -> Gold etc.). */
function colourFamily(finish: string | null): string | null {
  if (!finish) return null;
  const f = finish.toLowerCase();
  if (/gold|brass|champagne/.test(f)) return "Gold";
  if (/black/.test(f)) return "Black";
  if (/white|ivory/.test(f)) return "White";
  if (/chrome|silver|nickel|grey/.test(f)) return "Silver";
  if (/copper|brown/.test(f)) return "Brown";
  if (/blue/.test(f)) return "Blue";
  return null;
}

/** Lighting sentence carrying the attributes Merchant Center asks for:
 *  max wattage, finish, colour family, shade/body material, colour temp. */
function lightingDescription(p: Product): string {
  const bits: string[] = [];
  const kind = /torch|flashlight/i.test(p.name) ? "rechargeable torch"
    : /lantern|lighthouse/i.test(p.name) ? "solar lantern"
    : /pendant/i.test(p.name) ? "pendant light"
    : /wall light|\bwl\b|gate ?light/i.test(p.name) ? "wall light"
    : /downlight|down ?lighter|recess/i.test(p.name + " " + (spec(p, "Mounting Type") ?? "")) ? "recessed downlight"
    : /panel/i.test(p.name) ? "LED panel light"
    : /spot/i.test(p.name) ? "LED spotlight"
    : /batten/i.test(p.name) ? "LED batten"
    : /strip|rope/i.test(p.name) ? "LED strip light"
    : /street/i.test(p.name) ? "street light"
    : /bulb|lamp\b/i.test(p.name) ? "LED lamp"
    : "ceiling light";

  const watts = num(spec(p, "Wattage (W)") ?? spec(p, "Wattage") ?? spec(p, "Power Consumption") ?? p.name.match(/[\d.]+\s*W\b/)?.[0]);
  if (watts) bits.push(`${watts} W max wattage`);

  const kelvin = num(p.name.match(/\d{4}\s*K\b/)?.[0] ?? spec(p, "Colour Temperature"));
  if (kelvin) bits.push(`${kelvin} K`);

  const finish = finishFromName(p.name);
  if (finish) bits.push(`${finish.toLowerCase()} finish`);
  const fam = colourFamily(finish);
  if (fam) bits.push(`${fam.toLowerCase()} colour family`);

  // "Recess mounted pressure die-cast aluminium luminaire in WHT fixture"
  // -> "pressure die-cast aluminium" as the shade/body material.
  const matRaw = spec(p, "Material");
  if (matRaw) {
    const m = matRaw.match(/(pressure die-?cast aluminium|die-?cast aluminium|aluminium|polycarbonate|steel|metal|glass|abs)/i);
    if (m) bits.push(`${m[1].toLowerCase()} shade material`);
  }

  const holder = p.name.match(/\b(B22|E27|E14|GU10)\b/i);
  if (holder) bits.push(`${holder[1].toUpperCase()} holder`);

  const lumen = num(spec(p, "Rated Lumens") ?? spec(p, "Lumen"));
  if (lumen) bits.push(`${lumen} lumens`);

  const warranty = num(spec(p, "Warranty") ?? spec(p, "Guarantee"));
  if (warranty) bits.push(`${warranty} year warranty`);

  return `${p.name} by ${p.brand}: ${kind} with ${bits.length ? bits.join(", ") : "genuine manufacturer warranty"}.`;
}

/** Accessories (spike guards, plug tops, adaptors): rating + voltage + length. */
function accessoryDescription(p: Product): string {
  const bits: string[] = [];
  // The "Rating" spec can hold wattage ("1440 W"), so only accept a number
  // that is explicitly followed by an A.
  const amps = (`${spec(p, "Rating") ?? ""} ${p.name}`.match(/([\d.]+)\s*A\b/) || [])[1];
  if (amps) bits.push(`${amps} A rating`);
  const volts = num((p.attrs as Record<string, string> | undefined)?.["Max Voltage"] ?? spec(p, "Rated Voltage") ?? spec(p, "Voltage"));
  if (volts) bits.push(`${volts} V max voltage`);
  const len = num(spec(p, "Wire Length") ?? p.name.match(/\(([\d.]+)\s*m\)/)?.[1]);
  if (len) bits.push(`${len} m cable`);
  const warranty = num(spec(p, "Warranty"));
  if (warranty) bits.push(`${warranty} year warranty`);
  return `${p.name} by ${p.brand}${bits.length ? `: ${bits.join(", ")}` : ""}.`;
}

/**
 * The description used in the PDP meta tag and Product JSON-LD.
 * Category-aware where the attributes matter to Merchant Center (fans today);
 * everything else keeps the human-written spec line.
 */
export function productDescription(p: Product): string {
  // Metals: what copper buyers actually search - today's ₹/kg rate, the lot
  // sizes, and that the rate tracks MCX/LME. The PDP is revalidated on every
  // console save, so the rate in this description stays current.
  if (isMetalCategory(p.cat)) {
    const kg = lotKg(p.attrs);
    const rate = p.price / (1 + gstRateFor(p.cat, p.gstRate)) / kg;
    const lot = p.attrs?.Lot ? ` Sold in 3 MT and 4 MT lots (this listing: ${p.attrs.Lot}).` : "";
    return `${p.name} at today's rate of ₹${rate.toFixed(2)}/kg ex-GST, updated against MCX and LME copper up to three times a day.${lot} Book online with a 5% token, balance by RTGS, GST tax invoice with dispatch. Live rate charts on this page.`;
  }
  const tail = ` Elume price ₹${p.price} per ${p.unit} (MRP ₹${p.market}). Free delivery across India.`;
  if (p.cat === "Fans") return fanDescription(p) + tail;
  if (p.cat === "Lighting") return lightingDescription(p) + tail;
  if (p.cat === "Electrical Accessories") return accessoryDescription(p) + tail;
  return `${p.name} by ${p.brand}${p.spec ? ` (${p.spec})` : ""}.${tail}`;
}
