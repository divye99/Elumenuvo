import type { Product } from "@/lib/data";
import { adminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";

/**
 * Norisys premium treatment (owner, Aug 2026): the CUBE / SQUARE / TG9
 * catalogues carry a strict code system our 726 coded SKUs already use:
 *
 *     <STEM>.<FINISH>   e.g.  C5261.02, CG301.08, TM128.13, T9450.31
 *
 * The stem identifies the mechanism/plate; the two-digit suffix is the
 * FINISH. Everything here derives from that: finish swatches (siblings =
 * same stem, different suffix), series detection (prefix), and the
 * complete-the-plate pairing. Norisys-only - never applied to other brands.
 */

export const NORISYS_CODE_RE = /\b([A-Z]{1,2}\d{3,5})\s*\.\s*(\d{2})\b/;

/** Finish names per catalogue suffix - fallback when a product's own name
 *  does not state the finish. Derived from the catalogue legend + our data. */
export const NORISYS_FINISH: Record<string, string> = {
  "01": "Frost White",
  "02": "Quartz Gray",
  "04": "Solid Aluminium",
  "05": "Solid Aluminium Black",
  "06": "Solid Wood Dark Mahogany",
  "07": "Solid Wood Pinewood",
  "08": "Solid Glass Ice White",
  "09": "Solid Glass Metal Gray",
  "10": "Solid Marble Sparkle White",
  "11": "Solid Marble Terra Beige",
  "12": "Solid Marble Salt White",
  "13": "Solid Marble Onyx White",
  "14": "Solid Aluminium Bronze",
  "16": "Matt Gold",
  "17": "Charcoal Black",
  "18": "Solid Glass Smoked Silver",
  "19": "Solid Glass Black",
  "26": "Silver Dust",
  "29": "Solid Wood Walnut",
  "48": "Solid Glass Frosted Ultra White",
  "31": "Solid Metal Chrome Glossy",
  "32": "Solid Metal Chrome Matt",
  "33": "Solid Metal Black Glossy",
  "34": "Solid Metal Mellow Gold",
  "38": "Solid Glass Ultra White",
};

/** Swatch colours for the finish dots (merged into the variant picker). */
export const NORISYS_FINISH_HEX: Record<string, string> = {
  "Frost White": "#F4F5F7",
  "Quartz Gray": "#8D9299",
  "Solid Aluminium": "#C7CAD1",
  "Solid Aluminium Black": "#3A3D42",
  "Solid Aluminium Bronze": "#8A6A4F",
  "Solid Wood Dark Mahogany": "#5C3A28",
  "Solid Wood Pinewood": "#C9A16B",
  "Solid Wood Walnut": "#5A3E2B",
  "Solid Glass Ice White": "#EFF3F4",
  "Solid Glass Metal Gray": "#9BA1A8",
  "Solid Glass Smoked Silver": "#A8ABB3",
  "Solid Glass Black": "#23262B",
  "Solid Glass Ultra White": "#F2F4F5",
  "Solid Glass Frosted Ultra White": "#EDF1F2",
  "Terra Beige": "#CBB49A",
  "Matt Gold": "#C9A24B",
  "Charcoal Black": "#2B2E33",
  "Silver Dust": "#C4C7CC",
  "Metal Chrome Glossy": "#D5D8DE",
  "Metal Chrome Matt": "#B9BDC4",
  "Metal Black Glossy": "#1E2126",
  "Metal Mellow Gold": "#CFA860",
  "Solid Metal Chrome Glossy": "#D5D8DE",
  "Solid Metal Chrome Matt": "#B9BDC4",
  "Solid Metal Black Glossy": "#1E2126",
  "Solid Metal Mellow Gold": "#CFA860",
  "Solid Marble Sparkle White": "#EAE6DE",
  "Solid Marble Terra Beige": "#CBB49A",
  "Solid Marble Salt White": "#F0EDE6",
  "Solid Marble Onyx White": "#E5E2DB",
  White: "#FFFFFF",
};

export type NorisysCode = { stem: string; suffix: string };

export function norisysCode(p: { name: string; sku?: string | null }): NorisysCode | null {
  const m = `${p.name} ${p.sku ?? ""}`.match(NORISYS_CODE_RE);
  return m ? { stem: m[1], suffix: m[2] } : null;
}

/** Series from the code prefix: TG9 (T/TG/TM/TA/TW) or CUBE (C/CG/CA/V). */
export function norisysSeries(stem: string): "TG9" | "CUBE" {
  return /^T/.test(stem) ? "TG9" : "CUBE";
}

/** Finish label for one product: its own name first (it usually states the
 *  finish), the suffix legend as fallback. */
export function norisysFinishLabel(p: { name: string }, code: NorisysCode): string {
  const legend = NORISYS_FINISH[code.suffix];
  const n = p.name;
  const fromName = n.match(
    /\b(Solid Glass [A-Z][a-z]+(?: [A-Z][a-z]+)?|Solid Aluminium(?: [A-Z][a-z]+)?|Solid Wood(?: [A-Z][a-z]+)?|Solid Marble(?: [A-Z][a-z]+)?|Ice White|Frost White|Smoked Silver|Silver Dust|Charcoal Black|Glossy Black|Matt Gold|Mellow Gold|Quartz Gr[ae]y|Terra Beige|Metal Chrome (?:Glossy|Matt)|Metal Black Glossy|Chrome Glossy|Chrome Matt)\b/
  );
  if (fromName) {
    // Clean the raw capture: plate-words are not finishes, and grey/gray
    // must not split one finish into two facet rows.
    const label = fromName[0]
      .replace(/\s+(Cover(\s+Plates?)?|Plates?)$/i, "")
      .replace("Solid Glass Solid", "Solid Glass")
      .replace(/Grey/g, "Gray")
      .trim();
    // The catalogue legend wins whenever the name's words are a subset of
    // it: "Solid Wood" -> "Solid Wood Dark Mahogany", "Glossy Black" ->
    // "Metal Black Glossy", "Chrome Matt" -> "Metal Chrome Matt".
    if (legend && legend !== label) {
      const lw = new Set(legend.split(/\s+/));
      if (label.split(/\s+/).every((w) => lw.has(w))) return legend;
    }
    return label;
  }
  return legend ?? `Finish .${code.suffix}`;
}

/** Material family + tone for one finish label, for the two-level Finish
 *  filter: "Solid Wood Walnut" -> { family: "Solid Wood", tone: "Walnut" }.
 *  Single-colour thermoplastic finishes group under "Colours". */
export const NORISYS_FAMILIES = ["Solid Glass", "Solid Aluminium", "Solid Wood", "Solid Marble", "Solid Metal"] as const;
export function norisysFinishFamily(label: string): { family: string; tone: string } {
  for (const fam of NORISYS_FAMILIES) {
    if (label.startsWith(fam)) {
      const tone = label.slice(fam.length).trim();
      return { family: fam, tone: tone || (fam === "Solid Aluminium" ? "Natural" : "") };
    }
  }
  if (label.startsWith("Metal ")) return { family: "Solid Metal", tone: label.slice(6).trim() };
  return { family: "Colours", tone: label };
}

/* ── Engineering story: one set of three bullets per series, distilled from
 *    the catalogue's exploded views. Stored ONCE here, never per product. ── */
export const NORISYS_ENGINEERING: Record<"CUBE" | "TG9", { title: string; bullets: [string, string][] }> = {
  CUBE: {
    title: "CUBE Series engineering",
    bullets: [
      ["Fire-safe thermoset core", "Live parts sit in engineering-grade thermoset housing that resists heat and does not catch fire."],
      ["Steel-cored frames", "High-quality steel embedded in thermoplastic frames: extra stiffness and tight mounting tolerances."],
      ["Grip that lasts", "Sockets use elliptical spring-loaded tubes for a firm, uniform hold on plug pins, every insertion."],
    ],
  },
  TG9: {
    title: "TG9 Series engineering",
    bullets: [
      ["Fire-safe thermoset core", "Live parts sit in engineering-grade thermoset housing that resists heat and does not catch fire."],
      ["Arc shield inside", "An inner shield keeps arcing away from the front rocker and muffles the operating sound."],
      ["Precision module fit", "Snap-fit cover plates and strong locks: plates go on after the walls are painted, cleanly."],
    ],
  },
};

/** Compliance marks shown in quick specs (from the catalogue footer). */
export const NORISYS_BADGES = ["CE", "RoHS", "IS compliant"] as const;

/* ── Server helpers ─────────────────────────────────────────────── */

const CARD_COLS = "id, sku, brand_sku, elin, ship_weight_kg, name, brand, category, spec, mrp, elume_price, unit, image_url, units_sold, is_recommended, parent_id, market_low, gst_rate, in_stock, created_at, attrs";

function toProduct(r: any): Product {
  return {
    id: r.id, sku: r.sku ?? "", brandSku: r.brand_sku ?? undefined, elin: r.elin ?? undefined,
    name: r.name, brand: r.brand, cat: r.category, spec: r.spec ?? "",
    price: Number(r.elume_price), market: Number(r.mrp), unit: r.unit ?? "pc",
    image: r.image_url ?? undefined, unitsSold: r.units_sold ?? 0,
    inStock: r.in_stock !== false, attrs: r.attrs ?? {},
    marketLow: r.market_low != null ? Number(r.market_low) : undefined,
    gstRate: r.gst_rate != null ? Number(r.gst_rate) : undefined,
    parentId: r.parent_id ?? undefined, createdAt: r.created_at ?? undefined,
    shipWeightKg: r.ship_weight_kg != null ? Number(r.ship_weight_kg) : undefined,
  } as Product;
}

/** All in-stock Norisys rows (~0.5 MB), cached six hours under the "products"
 *  tag - one fetch feeds swatches and pairings for every Norisys PDP render. */
const norisysAll = unstable_cache(
  async () => {
    const db = adminClient();
    if (!db) return [] as any[];
    const out: any[] = [];
    for (let from = 0; from < 3000; from += 1000) {
      const { data } = await db.from("products").select(CARD_COLS).eq("brand", "Norisys").neq("in_stock", false).range(from, from + 999);
      if (!data?.length) break;
      out.push(...data);
      if (data.length < 1000) break;
    }
    return out;
  },
  ["norisys-all"],
  { revalidate: 6 * 3600, tags: ["products"] }
);

/** Finish siblings for one product: same stem, different suffix. Returned as
 *  Product[] with a synthetic `Finish` attr so the standard VariantPicker
 *  renders them as swatches - includes the product itself. */
export async function fetchNorisysFinishSiblings(p: Product): Promise<Product[]> {
  const code = norisysCode(p);
  if (!code) return [];
  const rows = await norisysAll();
  const family = rows
    .map(toProduct)
    .map((s) => ({ s, c: norisysCode(s) }))
    .filter((x): x is { s: Product; c: NorisysCode } => !!x.c && x.c.stem === code.stem);
  if (family.length < 2) return [];
  // Finish labels must be distinct per sibling for the picker; collide ->
  // disambiguate with the suffix.
  const used = new Map<string, number>();
  const out: Product[] = [];
  for (const { s, c } of family) {
    let label = norisysFinishLabel(s, c);
    const n = used.get(label) ?? 0;
    used.set(label, n + 1);
    if (n > 0) label = `${label} ·${c.suffix}`;
    out.push({ ...s, attrs: { ...(s.attrs ?? {}), Finish: label } });
  }
  return out;
}

export type NorisysPairing = { heading: string; items: Product[] };

const isPlate = (name: string) => /\b(cover plate|plate with|frame)\b/i.test(name) || /\bplate\b/i.test(name);
const moduleOf = (name: string) => name.match(/\b(\d{1,2})\s*(?:M\b|Module)/i)?.[1] ?? null;

/** Complete the plate: modules pair with plates of the same series + module
 *  count (finish-matched first); plates pair with popular mechanisms of the
 *  same series. The single biggest wrong-purchase preventer for modular. */
export async function fetchNorisysPairings(p: Product): Promise<NorisysPairing | null> {
  const code = norisysCode(p);
  if (!code) return null;
  const series = norisysSeries(code.stem);
  const mySize = moduleOf(p.name);
  const rows = (await norisysAll()).map(toProduct).filter((s) => s.id !== p.id);
  const inSeries = rows.filter((s) => {
    const c = norisysCode(s);
    return c && norisysSeries(c.stem) === series;
  });
  const myFinish = norisysFinishLabel(p, code);

  if (!isPlate(p.name)) {
    // A mechanism/module: offer plates that will carry it.
    let plates = inSeries.filter((s) => isPlate(s.name));
    if (mySize) {
      const sized = plates.filter((s) => moduleOf(s.name) === mySize);
      if (sized.length) plates = sized;
    }
    plates.sort((a, b) => {
      const fa = norisysFinishLabel(a, norisysCode(a)!) === myFinish ? 1 : 0;
      const fb = norisysFinishLabel(b, norisysCode(b)!) === myFinish ? 1 : 0;
      return fb - fa || (b.unitsSold ?? 0) - (a.unitsSold ?? 0);
    });
    if (!plates.length) return null;
    return { heading: mySize ? `Complete the plate · ${mySize}-module ${series} plates` : `Complete the plate · ${series} plates`, items: plates.slice(0, 8) };
  }
  // A plate: offer the mechanisms that go into it.
  let mods = inSeries.filter((s) => !isPlate(s.name));
  if (mySize) {
    const sized = mods.filter((s) => {
      const m = moduleOf(s.name);
      return m == null || Number(m) <= Number(mySize);
    });
    if (sized.length) mods = sized;
  }
  mods.sort((a, b) => (b.unitsSold ?? 0) - (a.unitsSold ?? 0));
  if (!mods.length) return null;
  return { heading: `Fill this plate · ${series} switches & sockets`, items: mods.slice(0, 8) };
}
