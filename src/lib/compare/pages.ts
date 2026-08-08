import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { PRODUCTS_CACHE_TAG } from "@/lib/products";
import { decodeEntities } from "@/lib/compare/fingerprint";

/**
 * Public comparison LANDING pages - the compare engine as an SEO asset.
 *
 * Every cross-brand like-to-like group in the design categories becomes an
 * indexable page ("Compare 6 A 1-module switches: Legrand vs Norisys vs
 * Havells prices") with the spec table and live prices. Nobody else has
 * spec-verified cross-brand price comparisons, and queries like
 * "<brand> vs <brand> <product>" are exactly how Indian buyers search.
 *
 * Wires & Cables is deliberately excluded for now (owner call: lead with
 * the design categories). Groups qualify with 2+ BRANDS - a single-brand
 * group is a variant list, not a comparison.
 */
export const COMPARE_PAGE_CATEGORIES = ["Modular", "Switchgear", "Lighting", "Fans", "Extension Boards"];

export type CompareGroupPage = {
  slug: string;
  key: string;
  category: string;
  title: string;       // human title fragment, e.g. "6 A 1-module switches"
  brands: string[];
  members: {
    id: string;
    name: string;
    brand: string;
    price: number; // GST-inclusive
    mrp: number;
    unit: string;
    cat: string;
    gstRate?: number;
    image?: string;
    display: [string, string][];
  }[];
};

const slugOf = (key: string) => key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function reader() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const k = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && k ? createClient(url, k, { auth: { persistSession: false } }) : null;
}

type Row = {
  id: string; name: string; brand: string; category: string; elume_price: number; mrp: number;
  unit: string; gst_rate: number | string | null; image_url: string | null; parent_id: string | null;
  in_stock: boolean | null; compare_key: string; compare_meta: { display?: [string, string][] } | null;
};

/** Human title fragment from the group's key specs, e.g.
 *  "6 A 1-module switches" / "4-socket 6 A extension boards". */
function titleFrom(category: string, members: Row[]): string {
  const display = members[0]?.compare_meta?.display ?? [];
  const val = (label: string) => {
    const v = display.find(([l]) => l.toLowerCase().includes(label))?.[1];
    return v && v !== "-" ? v : undefined; // "-" means the spec is unstated
  };
  switch (category) {
    case "Modular": {
      const type = (val("type") ?? "switches").toLowerCase();
      return [val("rating"), val("modules") ? `${val("modules")} ` : "", type.endsWith("s") ? type : `${type}s`].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }
    case "Switchgear":
      return [val("rating"), val("poles"), (val("type") ?? "MCBs") + (String(val("type") ?? "").endsWith("s") ? "" : "s")].filter(Boolean).join(" ");
    case "Lighting":
      return [val("wattage"), (val("type") ?? "LED lights").toLowerCase() + "s"].filter(Boolean).join(" ");
    case "Fans":
      return [val("sweep"), (val("type") ?? "fans").toLowerCase() + "s"].filter(Boolean).join(" ");
    case "Extension Boards":
      return [val("sockets") ? `${val("sockets")}-socket` : "", val("rating"), "extension boards"].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    default:
      return category.toLowerCase();
  }
}

const loadGroups = unstable_cache(
  async (): Promise<CompareGroupPage[]> => {
    const db = reader();
    if (!db) return [];
    try {
      const rows: Row[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await db
          .from("products")
          .select("id, name, brand, category, elume_price, mrp, unit, gst_rate, image_url, parent_id, in_stock, compare_key, compare_meta")
          .not("compare_key", "is", null)
          .eq("is_active", true)
          .in("category", COMPARE_PAGE_CATEGORIES)
          .range(from, from + 999);
        if (!data?.length) break;
        rows.push(...(data as Row[]));
        if (data.length < 1000) break;
      }
      const byKey = new Map<string, Row[]>();
      for (const r of rows) (byKey.get(r.compare_key) ?? byKey.set(r.compare_key, []).get(r.compare_key)!).push(r);

      const pages: CompareGroupPage[] = [];
      for (const [key, members] of byKey) {
        // one representative per family, in-stock only, dedupe colourways
        const seenFam = new Set<string>();
        const seenSig = new Set<string>();
        const reps = members
          .filter((m) => m.in_stock !== false)
          .sort((a, b) => a.elume_price - b.elume_price)
          .filter((m) => {
            const fam = m.parent_id ?? m.id;
            if (seenFam.has(fam)) return false;
            const sig = `${m.brand}|${(m.compare_meta?.display ?? []).map(([, v]) => v).join("~")}|${m.elume_price}`;
            if (seenSig.has(sig)) return false;
            seenFam.add(fam);
            seenSig.add(sig);
            return true;
          });
        const brands = [...new Set(reps.map((m) => m.brand))];
        if (brands.length < 2) continue;
        pages.push({
          slug: slugOf(key),
          key,
          category: members[0].category,
          title: titleFrom(members[0].category, reps),
          brands,
          members: reps.map((m) => ({
            id: m.id, name: decodeEntities(m.name), brand: m.brand, price: Number(m.elume_price), mrp: Number(m.mrp),
            unit: m.unit, cat: m.category, gstRate: m.gst_rate != null ? Number(m.gst_rate) : undefined,
            image: m.image_url ?? undefined, display: m.compare_meta?.display ?? [],
          })),
        });
      }
      return pages.sort((a, b) => b.members.length - a.members.length);
    } catch {
      return [];
    }
  },
  ["compare-pages"],
  { tags: [PRODUCTS_CACHE_TAG], revalidate: 3600 }
);

export async function listPublicCompareSlugs(): Promise<{ slug: string; category: string }[]> {
  return (await loadGroups()).map((g) => ({ slug: g.slug, category: g.category }));
}

export async function listCompareGroupPages(): Promise<CompareGroupPage[]> {
  return loadGroups();
}

export async function getCompareGroupPage(slug: string): Promise<CompareGroupPage | null> {
  return (await loadGroups()).find((g) => g.slug === slug) ?? null;
}

export { slugOf as compareSlugOf };
