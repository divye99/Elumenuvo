import { adminClient } from "@/lib/supabase/admin";

/**
 * Similarity engine for order-item replacement: given an (possibly
 * discontinued, even deleted) item's name/category/price, rank the live
 * catalogue by likeness. Scoring blends token overlap on name+spec,
 * same-category and same-brand bonuses, and price proximity — a practical
 * recommender that needs no training data, and sharpens automatically as
 * the catalogue's names/specs improve.
 */

export type SimilarProduct = { id: string; name: string; brand: string; category: string; price: number; mrp: number; image: string | null; score: number };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9. ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "and", "with", "for", "w", "watt", "havells", "polycab", "kei", "apar", "syska", "crompton", "atomberg", "norisys"]);

export async function similarProducts(item: { name: string; cat?: string | null; price?: number | null }, k = 6): Promise<SimilarProduct[]> {
  const db = adminClient();
  if (!db) return [];
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("products")
      .select("id, name, brand, category, spec, elume_price, mrp, image_url, units_sold")
      .eq("is_active", true)
      .range(from, from + 999);
    if (!data?.length) break;
    all.push(...data);
    if (data.length < 1000) break;
  }

  const brandGuess = item.name.match(/havells|polycab|kei|apar|syska|crompton|atomberg|norisys|philips|wipro|finolex|elume/i)?.[0]?.toLowerCase() ?? null;
  const tokens = norm(item.name).split(" ").filter((t) => t.length > 1 && !STOP.has(t));
  const price = Number(item.price) || null;

  const scored = all.map((p) => {
    const hay = norm(`${p.name} ${p.spec ?? ""}`);
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += t.length > 3 ? 3 : 1.5;
    if (item.cat && p.category === item.cat) score += 6;
    if (brandGuess && p.brand.toLowerCase() === brandGuess) score += 4;
    if (price && Number(p.elume_price) > 0) {
      const ratio = Math.min(price, Number(p.elume_price)) / Math.max(price, Number(p.elume_price));
      score += ratio * 5; // closer price → up to +5
    }
    score += Math.min(p.units_sold ?? 0, 20) / 10; // gentle popularity nudge
    return { p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ p, score }) => ({ id: p.id, name: p.name, brand: p.brand, category: p.category, price: Number(p.elume_price), mrp: Number(p.mrp), image: p.image_url, score: Math.round(score * 10) / 10 }));
}
