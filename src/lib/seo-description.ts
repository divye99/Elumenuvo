import type { Product } from "@/lib/data";

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

/**
 * The description used in the PDP meta tag and Product JSON-LD.
 * Category-aware where the attributes matter to Merchant Center (fans today);
 * everything else keeps the human-written spec line.
 */
export function productDescription(p: Product): string {
  const tail = ` Elume price ₹${p.price} per ${p.unit} (MRP ₹${p.market}). Free delivery across India.`;
  if (p.cat === "Fans") return fanDescription(p) + tail;
  return `${p.name} by ${p.brand}${p.spec ? ` (${p.spec})` : ""}.${tail}`;
}
