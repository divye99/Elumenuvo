/**
 * One-off backfill: Havells-grade tech_specs for every Norisys product,
 * composed from the brand's product catalogues (CUBE + TG9, OCR'd Aug 2026)
 * and the product names. Idempotent: merges over any existing tech_specs.
 *
 * Run from the repo root:
 *   set -a && source .env.local && set +a && npx tsx scripts/norisys-specs-backfill.ts [--dry]
 *
 * Sources for every non-name-derived fact (catalogue page refs):
 * - Box sizes: TG9 p32-42 ("For box size ..."), CUBE p70/p82-86 plate tables
 * - Ratings: CUBE marking "6A 240V AC / Made in India" (snapshot p13);
 *   TG9 marking "6A 230V" (p49); USB amp table CUBE p34
 * - Materials/engineering: CUBE p3 (bi-material frames, paint-safe plates),
 *   p8 (silver contacts, ring spring, shutters), p14 (glass/wood/marble),
 *   p21 (thermoset, UV-stable polycarbonate); TG9 p7/p11/p39
 * - CE + RoHS marks: printed beside products throughout both catalogues
 */
import { norisysCode, norisysFinishLabel, norisysSeries, norisysFinishFamily, NORISYS_FINISH } from "../src/lib/norisys";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY = process.argv.includes("--dry");

type Row = { id: string; name: string; category: string; tech_specs: Record<string, unknown> | null };
type Feature = { title: string; body: string };

/* ── Catalogue box-size tables ── */
// TG9 plates by module count (TG9 catalogue p32-42; same across materials).
const TG9_BOX: Record<string, string> = {
  "1": '3" x 3" (75mm x 75mm)',
  "2": '3" x 3" (75mm x 75mm)',
  "3": '4" x 3" (100mm x 75mm)',
  "4": '5" x 3" (135mm x 75mm)',
  "6": '8" x 3" (210mm x 75mm)',
  "8": '9"/8" x 3" (230/210mm x 80mm)',
};
// CUBE Smart/Vector/Flat'5 plates (CUBE catalogue p70). 1M/2M differ between
// sub-ranges, so they are deliberately omitted.
const CUBE_BOX: Record<string, string> = {
  "3": "100mm x 75mm (4x3)",
  "4": "135mm x 75mm (5x3)",
  "6": "210mm x 75mm (8x3)",
  "12": "140mm x 210mm (8x6)",
  "14": "140mm x 210mm (8x6)",
  "21": "210mm x 210mm (8x8)",
};
const CUBE_BOX_VERTICAL_8M = "135mm x 140mm (5x5)";
// CUBE special-material plates (glass/aluminium/wood/marble, p82-86).
const CUBE_SPECIAL_BOX: Record<string, string> = {
  "2": "93mm x 95mm (3x3)",
  "4": "93mm x 158mm (3x5)",
};
// USB charger outputs by stem (CUBE catalogue p34; TG9 p24 matches).
const USB_OUTPUT: Record<string, string> = {
  C5736: "USB A-type, 2.1 A", C5836: "USB C-type, 2.1 A", C5936: "USB A+C, 2.1 A",
  C5837: "USB C-type, 3.1 A", C5938: "USB C-type, 3.1 A", C5939: "USB A+C, 3.1 A",
};

/* ── Type detection from the product name ── */
function typeOf(n: string): string {
  const t = n.toLowerCase();
  if (/\bmcb\b/.test(t)) return "MCB";
  if (/blanking/.test(t)) return "Blanking plate";
  if (/\b(plate|cover)\b/.test(t)) return "Cover plate";
  if (/usb|charger/.test(t)) return "USB charger";
  if (/hdmi/.test(t)) return "HDMI socket";
  if (/coaxial|t\.?v\.? socket/.test(t)) return "TV socket";
  if (/telephone|rj-?11/.test(t)) return "Telephone socket";
  if (/information socket|rj-?45|computer/.test(t)) return "Data socket";
  if (/regulator/.test(t)) return "Fan regulator";
  if (/dimmer/.test(t)) return "Dimmer";
  if (/bell/.test(t)) return "Bell push";
  if (/shaver/.test(t)) return "Shaver socket";
  if (/lamp/.test(t)) return "Marker lamp";
  if (/socket/.test(t)) return "Socket";
  if (/switch/.test(t)) return "Switch";
  return "Modular accessory";
}

const FACE_MATERIAL: Record<string, string> = {
  "Solid Glass": "Tempered, toughened solid glass",
  "Solid Wood": "Natural seasoned wood, protective hardened coat",
  "Solid Marble": "Solid marble, machined from the block",
  "Solid Aluminium": "Machined solid aluminium",
  "Solid Metal": "Solid metal",
  Colours: "UV-stabilised virgin-grade polycarbonate",
};

const MATERIAL_FEATURE: Record<string, Feature> = {
  "Solid Glass": { title: "Tempered solid glass face", body: "Engineered glass, tempered and toughened for ruggedness and a uniform lustre." },
  "Solid Wood": { title: "Seasoned natural wood", body: "Crafted from treated, seasoned natural wood; protective coatings and surface hardeners make the surface wear resistant." },
  "Solid Marble": { title: "Machined solid marble", body: "Individually machined from solid blocks, so the end product is a crisp, clean-cut flat plate." },
  "Solid Aluminium": { title: "Machined solid aluminium", body: "Individually machined for clean edges and a precise surface finish that blends with furniture." },
  "Solid Metal": { title: "Solid metal face", body: "Solid-metal front plates in chrome, black and gold tones over the TG9 mechanism." },
  Colours: { title: "UV-stable polycarbonate", body: "High-gloss virgin-grade, UV-stabilised polycarbonate that resists the colour failures common to ordinary plastics." },
};

function buildOne(row: Row) {
  const n = row.name;
  const code = norisysCode({ name: n });
  const series = code ? norisysSeries(code.stem) : /tg9/i.test(n) ? "TG9" : "CUBE";
  const type = typeOf(n);
  const specs: Record<string, string> = { Brand: "Norisys", Series: `${series} Series` };
  if (code) specs["Product code"] = `${code.stem}.${code.suffix}`;
  specs["Product type"] = type;

  // Finish: same logic as the storefront swatches.
  let finish = code ? norisysFinishLabel({ name: n }, code) : "";
  if (!finish) {
    const hit = Object.values(NORISYS_FINISH).find((f) => f.length > 4 && n.includes(f));
    finish = hit ?? "";
  }
  if (finish && finish !== "White") specs.Finish = finish;
  const family = finish ? norisysFinishFamily(finish).family : "Colours";

  // Module size (2M / "6 Module" / "1m").
  const mm = n.match(/\b(\d{1,2})\s*M\b/i) ?? n.match(/\b(\d{1,2})\s*Module\b/i);
  const modules = mm?.[1];
  if (modules) specs["Module size"] = `${modules} module (${modules}M)`;
  const vertical = /vertical/i.test(n);

  const amp = n.match(/\b(\d{1,2})\s*A\b/)?.[1];
  const watt = n.match(/\b(\d{2,4})\s*W\b/)?.[1];
  const way = n.match(/\b(one|two|1|2)\s*way\b/i)?.[1];
  const pole = n.match(/\b(SP|DP)\b/)?.[1] ?? (/single pole/i.test(n) ? "SP" : /double pole/i.test(n) ? "DP" : undefined);

  const features: Feature[] = [];
  const key: string[] = [];
  let description = "";

  const isPlate = type === "Cover plate" || type === "Blanking plate";
  const isMech = ["Switch", "Socket", "Fan regulator", "Dimmer", "Bell push", "Shaver socket", "Marker lamp", "USB charger", "HDMI socket", "TV socket", "Telephone socket", "Data socket"].includes(type);

  if (isPlate && type === "Cover plate") {
    const cut = n.match(/With ((?:\d+ ?(?:Holes?|(?:Socket )?Windows?|M Windows?))(?:\s*\+\s*\d+ ?(?:Holes?|(?:Socket )?Windows?|M Windows?))*)/i)?.[1];
    if (cut) specs["Cutout configuration"] = cut.replace(/\s+/g, " ");
    specs["Face material"] = FACE_MATERIAL[family] ?? FACE_MATERIAL.Colours;
    if (/frame/i.test(n)) specs.Frame = "Bi-material frame (steel core in engineering plastic), included";
    specs.Mounting = "Snap-fit; mounts after wall painting";
    // Box size only where the catalogue table is unambiguous.
    let box: string | undefined;
    if (modules) {
      if (series === "TG9") box = TG9_BOX[modules];
      else if (["Solid Glass", "Solid Aluminium", "Solid Wood", "Solid Marble"].includes(family)) box = CUBE_SPECIAL_BOX[modules];
      else box = vertical && modules === "8" ? CUBE_BOX_VERTICAL_8M : CUBE_BOX[modules];
    }
    if (box) specs["Suitable flush box"] = box;

    features.push(
      { title: "Mounts after painting", body: "The cover plate snaps on after the walls are painted, so the finish never meets a paintbrush, and it can be changed later without disturbing the wiring." },
      { title: "Steel-cored bi-material frame", body: "The support frame embeds steel inside engineering plastic: steel for rigid, accurate mounting; plastic for insulation and rust-proofing." },
      MATERIAL_FEATURE[family] ?? MATERIAL_FEATURE.Colours,
    );
    key.push("Snap-fit face: mounts after wall painting");
    if (box) key.push(`Suitable for ${box} flush box`);
    if (/frame/i.test(n)) key.push("Bi-material steel-cored frame included");
    description = `${series} Series ${modules ? `${modules}-module ` : ""}cover plate${finish ? ` in ${finish}` : ""}${/frame/i.test(n) ? " with frame" : ""}. The face snaps on after painting and swaps any time without touching the wiring.`;
  }

  if (isMech) {
    if (amp) specs["Rated current"] = `${amp} A`;
    if (watt) specs["Rated wattage"] = `${watt} W`;
    if (type === "Shaver socket") specs["Rated voltage"] = "220 V / 110 V";
    else if (type !== "USB charger" && (amp || ["Switch", "Socket", "Fan regulator", "Dimmer", "Bell push"].includes(type)))
      specs["Rated voltage"] = series === "CUBE" ? "240 V AC" : "230 V AC";
    if (way) specs["Switching"] = `${/1|one/i.test(way) ? "One" : "Two"} way${pole ? `, ${pole === "DP" ? "double pole (DP)" : "single pole (SP)"}` : ""}`;
    else if (pole) specs.Poles = pole === "DP" ? "Double pole (DP)" : "Single pole (SP)";
    if (/indicator/i.test(n)) specs.Indicator = "LED indicator";
    if (code && USB_OUTPUT[code.stem]) specs["Charging output"] = USB_OUTPUT[code.stem];
    specs["Body material"] = "Fire-retardant engineering-grade thermoset";
    specs.Mounting = "Snap-fit module on bi-material frame";

    if (type === "Switch" || type === "Dimmer" || type === "Bell push") {
      features.push(
        { title: "Silver-rich contacts", body: "A higher quantum of silver in the contacts reduces electric arcing considerably, ensuring a trouble-free long life." },
        { title: "Snap action, wiping contacts", body: "Snap-action mechanism with the right contact pressure and a wiping action between contacts keeps arcing to a minimum." },
        { title: "Fire-safe thermoset body", body: "Live parts sit in engineering-grade thermoset that withstands heat and does not catch fire." },
      );
      if (series === "TG9") features.push({ title: "A soft click", body: "The dolly-to-mechanism motion is cushioned for smoothness; a soft click is all it takes to switch on." });
      key.push(amp ? `${amp} A, ${specs["Rated voltage"]} rating` : "Silver-rich low-arc contacts", "Fire-safe thermoset housing", "Snap-fit module on bi-material frame");
      description = `${series} Series ${modules ? `${modules}-module ` : ""}${amp ? `${amp} A ` : ""}${type.toLowerCase()}${/indicator/i.test(n) ? " with LED indicator" : ""}. Silver-rich snap-action contacts for a long, spark-free life.`;
    } else if (type === "Socket") {
      features.push(
        { title: "Ring-spring grip", body: "A unique ring-shaped spring keeps uniform pressure on the brass contact tubes, clamping plug pins tightly for a firm, spark-free contact that prevents burnouts." },
        { title: "Child-protected shutters", body: "Safety shutters prevent accidental contact with live parts, reducing the risk of electric shock." },
        { title: "Shrouded live parts", body: "Terminals and current-carrying parts are properly shrouded, and live parts are separated by thermoset so they cannot fuse together under overheating." },
      );
      key.push(amp ? `${amp} A, ${specs["Rated voltage"]} rating` : "Ring-spring plug grip", "Child-protected safety shutters", "Fire-safe thermoset housing");
      description = `${series} Series ${modules ? `${modules}-module ` : ""}${amp ? `${amp} A ` : ""}shuttered socket. Ring-spring grip on the plug pins for spark-free contact; child-protected shutters.`;
    } else {
      features.push(
        { title: "Fire-safe thermoset body", body: "Live parts sit in engineering-grade thermoset that withstands heat and does not catch fire." },
        { title: "Snap-fit mounting", body: "Modules snap onto steel-cored bi-material frames with high accuracy, without force, and stay stress-free after mounting." },
      );
      if (specs["Charging output"]) key.push(`Charging output: ${specs["Charging output"]}`);
      if (watt) key.push(`${watt} W rating`);
      key.push("Fire-safe thermoset housing", "Snap-fit module on bi-material frame");
      description = `${series} Series ${modules ? `${modules}-module ` : ""}${type.toLowerCase()}. Fire-safe thermoset body, snap-fit on the ${series} bi-material frame.`;
    }
  }

  if (type === "MCB") {
    if (amp) specs["Rated current"] = `${amp} A`;
    if (pole) specs.Poles = pole === "DP" ? "Double pole (DP)" : "Single pole (SP)";
    specs["Form factor"] = "Tiny MCB (modular, plate-mounted)";
    key.push(amp ? `${amp} A miniature circuit breaker` : "Miniature circuit breaker", "Mounts inside the modular plate like a switch");
    description = `${series} Series tiny MCB${amp ? `, ${amp} A` : ""}${pole ? `, ${pole}` : ""}: overload protection that mounts in the switch plate itself.`;
  }

  specs.Certifications = "CE, RoHS";
  specs["Country of origin"] = "India";
  key.push("CE and RoHS marked");

  const existing = row.tech_specs ?? {};
  const existingSpecs = (existing as { specs?: Record<string, string> }).specs ?? {};
  return {
    ...existing,
    specs: { ...existingSpecs, ...specs },
    description,
    key_features: key,
    features,
    source: "Norisys product catalogue",
  };
}

async function main() {
  const res = await fetch(`${URL}/rest/v1/products?brand=eq.Norisys&select=id,name,category,tech_specs`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  const rows: Row[] = await res.json();
  console.log(`Norisys rows: ${rows.length}`);
  let ok = 0, fail = 0;
  for (const row of rows) {
    const tech = buildOne(row);
    if (DRY) {
      if (ok < 4) console.log(row.name, "\n", JSON.stringify(tech, null, 1).slice(0, 1200), "\n");
      ok++;
      continue;
    }
    const r = await fetch(`${URL}/rest/v1/products?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ tech_specs: tech }),
    });
    if (r.ok) ok++;
    else { fail++; console.log("FAIL", row.id, r.status, (await r.text()).slice(0, 120)); }
  }
  console.log(`done: ${ok} ok, ${fail} failed${DRY ? " (dry run)" : ""}`);
}

main();
