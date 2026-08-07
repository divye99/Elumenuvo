import { createClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { conflictsCompatible } from "@/lib/compare/fingerprint";
import { loadCompareBoosts } from "@/lib/compare/signals";

/**
 * Assemble the "Compare with other items" rail for one product page.
 *
 * Membership is the hard part and it is already decided by the time we get
 * here: compare_key equality (built by src/lib/compare/build.ts). This
 * function applies the runtime filters -
 *   · never the product's own colour/length family (those are variations,
 *     not alternatives; the variant picker owns them),
 *   · in-stock and active only (the rail is a buying tool),
 *   · soft-spec conflicts must not contradict (C-curve vs D-curve),
 *   · admin rejections are permanent kill-switches,
 * - then orders by learned engagement (compare_pick/compare_add signals)
 * with price as the tiebreak, capped at 8. Empty result → the PDP renders
 * no element at all.
 */

export type CompareItem = {
  id: string;
  name: string;
  brand: string;
  price: number; // GST-inclusive Elume price
  mrp: number;
  unit: string;
  cat: string;
  gstRate?: number;
  image?: string;
  display: [string, string][];
};

type GroupRow = {
  id: string;
  name: string;
  brand: string;
  category: string;
  elume_price: number;
  mrp: number;
  unit: string;
  gst_rate: number | string | null;
  image_url: string | null;
  parent_id: string | null;
  in_stock: boolean | null;
  compare_meta: { conflicts?: Record<string, string>; display?: [string, string][] } | null;
};

function reader() {
  const a = adminClient();
  if (a) return a;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

export async function fetchCompareRail(productId: string): Promise<{ currentDisplay: [string, string][]; items: CompareItem[] } | null> {
  const db = reader();
  if (!db) return null;
  try {
    const { data: me } = await db
      .from("products")
      .select("id, parent_id, compare_key, compare_meta")
      .eq("id", productId)
      .maybeSingle();
    const key = me?.compare_key as string | null | undefined;
    const meta = (me?.compare_meta ?? null) as GroupRow["compare_meta"];
    if (!me || !key) return null;
    const myFamily = (me.parent_id as string | null) ?? me.id;
    const myConflicts = meta?.conflicts ?? {};

    const [{ data: group }, { data: rejected }, boosts] = await Promise.all([
      db
        .from("products")
        .select("id, name, brand, category, elume_price, mrp, unit, gst_rate, image_url, parent_id, in_stock, compare_meta")
        .eq("compare_key", key)
        .eq("is_active", true)
        .neq("id", productId)
        .limit(120),
      db.from("compare_rejections").select("a, b").or(`a.eq.${productId},b.eq.${productId}`),
      loadCompareBoosts(),
    ]);
    const killed = new Set((rejected ?? []).map((r: { a: string; b: string }) => (r.a === productId ? r.b : r.a)));

    const seenFamilies = new Set<string>([myFamily]);
    const seenNames = new Set<string>();
    const perBrand = new Map<string, number>();
    const items: CompareItem[] = [];
    const candidates = ((group ?? []) as GroupRow[])
      .filter((r) => r.in_stock !== false)
      .filter((r) => !killed.has(r.id))
      .filter((r) => conflictsCompatible(myConflicts, r.compare_meta?.conflicts ?? {}))
      .sort((a, b) => (boosts.get(b.id) ?? 0) - (boosts.get(a.id) ?? 0) || a.elume_price - b.elume_price);

    for (const r of candidates) {
      // One card per family: the rail compares alternatives, and a family's
      // colours are the same alternative. First survivor of a family (already
      // engagement/price ordered) represents it. Two extra dedupes keep the
      // rail diverse instead of a wall of one brand's colourways: max 2 cards
      // per brand, and never two cards whose names differ only by colour
      // suffix (duplicate listings exist in the catalogue).
      const fam = r.parent_id ?? r.id;
      if (seenFamilies.has(fam)) continue;
      const baseName = r.name.split("·")[0].trim().toLowerCase();
      if (seenNames.has(baseName)) continue;
      if ((perBrand.get(r.brand) ?? 0) >= 2) continue;
      seenFamilies.add(fam);
      seenNames.add(baseName);
      perBrand.set(r.brand, (perBrand.get(r.brand) ?? 0) + 1);
      items.push({
        id: r.id,
        name: r.name,
        brand: r.brand,
        price: Number(r.elume_price),
        mrp: Number(r.mrp),
        unit: r.unit,
        cat: r.category,
        gstRate: r.gst_rate != null ? Number(r.gst_rate) : undefined,
        image: r.image_url ?? undefined,
        display: r.compare_meta?.display ?? [],
      });
      if (items.length >= 8) break;
    }

    if (items.length === 0) return null;
    return { currentDisplay: meta?.display ?? [], items };
  } catch {
    return null; // compare must never break a product page
  }
}
