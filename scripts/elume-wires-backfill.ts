/**
 * Elume house-wire data from the Factor X catalogue (Elume_catalouge_Final_2.pdf):
 *  A. FR range (168 live SKUs): merge the catalogue's size table into the
 *     structured wire tech_specs (conductor construction, insulation
 *     thickness, OD, casing/concealed current ratings, DC resistance) and add
 *     the manufacturer description / key features / feature cards so wire
 *     PDPs read as fully as brand-site imports.
 *  B. HFFR range (owner, Aug 2026: flagship, 90 m coils only): create 5 sizes
 *     x 7 marketing colours = 35 products as HIDDEN DRAFTS (is_active=false)
 *     with PROVISIONAL pricing (FR twin x 1.25, rounded to Rs.10) for owner
 *     review; flip is_active + set real prices on approval.
 *
 * Idempotent. Run from repo root:
 *   set -a && source .env.local && set +a && npx tsx scripts/elume-wires-backfill.ts [--dry]
 */

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DRY = process.argv.includes("--dry");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// Catalogue size table (both FR and HFFR print identical values for the
// overlapping sizes). 10 sq mm has no catalogue row: it keeps its existing
// specs and gains only the shared narrative.
const TABLE: Record<string, { strands: string; thk: number; od: number; casing: number; concealed: number; res: number }> = {
  "0.5": { strands: "16/0.2", thk: 0.6, od: 2.6, casing: 6, concealed: 5, res: 39.0 },
  "0.75": { strands: "24/0.2", thk: 0.6, od: 2.8, casing: 7.5, concealed: 7, res: 26.0 },
  "1": { strands: "32/0.2", thk: 0.6, od: 3.0, casing: 12, concealed: 11, res: 19.5 },
  "1.5": { strands: "30/0.25", thk: 0.6, od: 3.4, casing: 16, concealed: 14, res: 13.3 },
  "2.5": { strands: "50/0.25", thk: 0.7, od: 4.1, casing: 22, concealed: 19, res: 7.98 },
  "4": { strands: "56/0.3", thk: 0.8, od: 4.8, casing: 29, concealed: 26, res: 4.95 },
  "6": { strands: "84/0.3", thk: 0.8, od: 5.3, casing: 37, concealed: 31, res: 3.3 },
};

const COLOUR_REAL: Record<string, string> = {
  Ultraviolet: "bright purple", "Solar Flare": "yellow", Aurora: "green", Ember: "red",
  Midnight: "blue", Moonlight: "white", Eclipse: "black",
};

const STANDARDS = ["IS 694", "IS 8130", "RoHS", "REACH", "CE (generally conforming)"];

const FR_ABOUT = {
  description:
    "Elume FR is a multi-stranded flexible copper wire built for the modern Indian home. Its FR PVC insulation handles overloads, resists moisture and self-extinguishes, protecting the family on the other side of the wall, not just the circuit. Every metre is spark-tested and conductivity-verified before it leaves our facility.",
  key_features: [
    "99.9% pure electrolytic grade copper, drawn, annealed and bunched",
    "Self-extinguishing FR PVC insulation with high insulation resistance",
    "Every metre spark-tested and conductivity-verified",
    "'elume' printed along the full length for easy identification",
    "IS 694 certified; RoHS and REACH compliant",
  ],
  features: [
    { title: "Pure copper, no compromise", body: "Built from 99.9% pure electrolytic grade copper, drawn, annealed and bunched for maximum flexibility, conductivity and long life." },
    { title: "FR insulation that stands guard", body: "A precisely formulated FR PVC compound, extruded on precision high-speed lines for consistent thickness across every metre. It handles overloads safely and resists boiling water, steam and moisture." },
    { title: "Tested beyond the standard", body: "Oxygen Index and Smoke Density tested generally conforming to ASTM D2863 and D2843, with results that outperform standard PVC cables." },
    { title: "Spark-tested. Every coil.", body: "Every coil is spark-tested and conductivity-verified before it leaves the facility. That is not a policy, it is a promise." },
  ],
};

const HFFR_ABOUT = {
  description:
    "Elume HFFR is our flagship wire, built for buildings where lives depend on every wire: hospitals, hotels, schools and high-rises. Its 100% halogen-free compound produces minimal, transparent, non-toxic smoke in a fire, giving everyone inside the critical time they need to get out safely. RoHS and REACH compliant, cleared for the most stringent international markets.",
  key_features: [
    "100% halogen-free flame retardant compound, PVC free",
    "Does not melt or drip during a fire; minimal, non-toxic smoke",
    "99.9% pure electrolytic grade copper conductor",
    "Every metre spark-tested and conductivity-verified",
    "IS 694 certified; RoHS and REACH compliant",
  ],
  features: [
    { title: "Zero halogen, full protection", body: "The insulation is a specially developed Halogen-Free Flame Retardant compound, 100% PVC free. Unlike standard insulation it does not melt or drip during a fire." },
    { title: "Smoke that does not kill", body: "The smoke produced is minimal, transparent and completely non-toxic, giving people inside a building the critical extra time needed to evacuate safely." },
    { title: "Pure copper, no compromise", body: "Built from 99.9% pure electrolytic grade copper, drawn, annealed and bunched for maximum flexibility, conductivity and long life." },
    { title: "Cleared for the world", body: "RoHS and REACH compliant and tested generally conforming to ASTM D2863 and D2843, outperforming standard PVC cables." },
  ],
};

type Row = {
  id: string; name: string; elume_price: number; mrp: number | null; market_low: number | null;
  is_active: boolean; in_stock: boolean; sku: string | null; elin: string | null; parent_id: string | null;
  attrs: Record<string, string> | null; spec: string | null; unit: string | null; gst_rate: number | null;
  hsn: string | null; ship_weight_kg: number | null; image_url: string | null; images: string[] | null;
  tech_specs: Record<string, unknown> | null; sort_order: number | null;
};

function sizeOf(attrs: Record<string, string> | null): string | null {
  const s = attrs?.Size ?? "";
  const m = s.match(/([\d.]+)/);
  return m ? m[1] : null;
}

function mergedSpecs(row: Row, line: "FR" | "HFFR") {
  const t = (row.tech_specs ?? {}) as Record<string, any>;
  const size = sizeOf(row.attrs);
  const cat = size ? TABLE[size] : undefined;
  const about = line === "FR" ? FR_ABOUT : HFFR_ABOUT;
  const out: Record<string, unknown> = {
    ...t,
    line: `Elume ${line}`,
    source: "Elume product catalogue",
    conductor: {
      ...(t.conductor ?? {}),
      material: "99.9% bright annealed electrolytic copper (IS 8130)",
      class: "5",
      ...(cat ? { strands: cat.strands, resistance_ohm_km: cat.res } : {}),
    },
    insulation: {
      ...(t.insulation ?? {}),
      material: line === "FR"
        ? "FR PVC, flame retardant, self-extinguishing"
        : "Halogen-Free Flame Retardant (HFFR) compound, 100% PVC free, self-extinguishing",
      ...(cat ? { thickness_mm: cat.thk } : {}),
    },
    ...(cat ? {
      dimensions: { ...(t.dimensions ?? {}), overall_diameter_mm: cat.od },
      current_rating_a: { min: cat.concealed, max: cat.casing, raw: [cat.casing, cat.concealed] },
    } : {}),
    voltage_grade_v: t.voltage_grade_v ?? 1100,
    standards: [...new Set([...(t.standards ?? []), ...STANDARDS])],
    colours: t.colours ?? Object.keys(COLOUR_REAL),
    marking: "Printed 'elume' along the full length",
    ...about,
  };
  return out;
}

async function patch(id: string, body: Record<string, unknown>) {
  const r = await fetch(`${BASE_URL}/rest/v1/products?id=eq.${id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) console.log("PATCH FAIL", id, r.status, (await r.text()).slice(0, 120));
  return r.ok;
}

async function main() {
  const res = await fetch(`${BASE_URL}/rest/v1/products?brand=eq.Elume&category=eq.${encodeURIComponent("Wires & Cables")}&select=id,name,elume_price,mrp,market_low,is_active,in_stock,sku,elin,parent_id,attrs,spec,unit,gst_rate,hsn,ship_weight_kg,image_url,images,tech_specs,sort_order&limit=400`, { headers: H });
  const rows: Row[] = await res.json();
  const fr = rows.filter((r) => /Elume FR/i.test(r.name));
  const existingHffr = new Set(rows.filter((r) => /HFFR/i.test(r.name)).map((r) => r.id));
  console.log(`FR rows: ${fr.length}; existing HFFR: ${existingHffr.size}`);

  // ── A. FR enrichment ──
  let ok = 0;
  for (const row of fr) {
    const tech = mergedSpecs(row, "FR");
    if (DRY) { if (ok === 0) console.log(JSON.stringify(tech, null, 1).slice(0, 1200)); ok++; continue; }
    if (await patch(row.id, { tech_specs: tech })) ok++;
  }
  console.log(`FR specs updated: ${ok}`);

  // ── B. HFFR drafts ──
  const HFFR_SIZES = ["1", "1.5", "2.5", "4", "6"];
  const fr90 = fr.filter((r) => (r.attrs?.Length ?? "") === "90 m" && HFFR_SIZES.includes(sizeOf(r.attrs) ?? ""));
  // deterministic ELIN sequence after the current house max
  const maxRes = await fetch(`${BASE_URL}/rest/v1/products?elin=like.ELUME*&select=elin&order=elin.desc&limit=1`, { headers: H });
  const maxElin = ((await maxRes.json())[0]?.elin ?? "ELUME00000") as string;
  let seq = parseInt(maxElin.replace("ELUME", ""), 10);
  const colourSlug = (c: string) => c.toLowerCase().replace(/\s+/g, "-");
  const sizeSlug = (s: string) => s.replace(".", "p");
  const rootId = "elume-hffr-2p5-90-ultraviolet";
  const idOf = (t: Row) => `elume-hffr-${sizeSlug(sizeOf(t.attrs)!)}-90-${colourSlug(t.attrs!.Colour)}`;
  const sorted = [...fr90].sort((a, b) =>
    // the family root inserts first so children can reference it
    Number(idOf(b) === rootId) - Number(idOf(a) === rootId) ||
    (parseFloat(sizeOf(a.attrs)!) - parseFloat(sizeOf(b.attrs)!)) || (a.attrs!.Colour < b.attrs!.Colour ? -1 : 1));
  let created = 0, skipped = 0;
  for (const twin of sorted) {
    const size = sizeOf(twin.attrs)!;
    const colour = twin.attrs!.Colour;
    const id = `elume-hffr-${sizeSlug(size)}-90-${colourSlug(colour)}`;
    if (existingHffr.has(id)) { skipped++; continue; }
    seq += 1;
    const price = Math.round((twin.elume_price * 1.25) / 10) * 10;
    const body = {
      id,
      name: twin.name.replace("Elume FR", "Elume HFFR"),
      brand: "Elume",
      category: "Wires & Cables",
      elume_price: price,
      mrp: price,
      market_low: null,
      is_active: false, // hidden draft until owner approves range + pricing
      in_stock: true,
      sku: `ELM-HFFR-${size}-90-${colour.toUpperCase().replace(/\s+/g, "")}`,
      elin: `ELUME${String(seq).padStart(5, "0")}`,
      parent_id: id === rootId ? null : rootId,
      attrs: { Size: `${size} sq mm`, Colour: colour, Length: "90 m" },
      spec: `Elume HFFR · ${size} sq mm · single core · class-5 flexible copper (IS 8130) · 90 m coil · HFFR, halogen-free, self-extinguishing · 1100 V · IS 694 · ${colour} (${COLOUR_REAL[colour] ?? colour.toLowerCase()})`,
      unit: twin.unit,
      gst_rate: twin.gst_rate,
      hsn: twin.hsn,
      ship_weight_kg: twin.ship_weight_kg,
      image_url: twin.image_url,
      images: twin.images,
      sort_order: twin.sort_order,
      tech_specs: mergedSpecs({ ...twin, tech_specs: null }, "HFFR"),
    };
    if (DRY) { if (created === 0) console.log(JSON.stringify(body, null, 1).slice(0, 1400)); created++; continue; }
    const r = await fetch(`${BASE_URL}/rest/v1/products`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (r.ok) created++;
    else console.log("INSERT FAIL", id, r.status, (await r.text()).slice(0, 160));
  }
  // The root must exist before children reference it: sorted order puts
  // 1 sq mm first, so retry any child that failed because the root was
  // missing... simpler: we insert the root FIRST explicitly above via order.
  console.log(`HFFR created: ${created}, skipped existing: ${skipped}${DRY ? " (dry)" : ""}`);
}

main();
