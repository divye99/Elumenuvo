import type { Product } from "@/lib/data";
import { fetchProductsLite } from "@/lib/products";
import { adminClient } from "@/lib/supabase/admin";
import { getCategoryRanks } from "@/lib/blog";
import { visibilityScore, diversify } from "@/lib/ranking";

/**
 * "For you" personalization - v1 of the recommendation engine.
 *
 * Signals, all first-party:
 *   • their ORDERS (strongest signal - money was spent);
 *   • their VIEWS (site_events pageviews, joined to them via the identify
 *     events that link device sids to their email);
 *   • their SEARCH KEYWORDS (search_queries by the same sids);
 *   • our EDITORIAL ranks (the blogs) inside the categories they shop.
 *
 * Recommendation score, per candidate product in their categories:
 *   base visibilityScore (stock gate, photo rule, sales, editorial, freshness)
 *   + keyword affinity  (their search tokens appearing in the product name)
 *   + brand affinity    (brands they buy/view get a nudge)
 *   - already ordered   (excluded outright: recommending what you own is noise)
 *
 * Deliberately simple, fully explainable, and every input is already being
 * collected - the "redevelop as we go" path is swapping this scorer out.
 */
export type ForYouData = {
  ordered: Product[];
  viewed: Product[];
  brands: string[];
  recommended: Product[];
  keywords: string[];
};

const UNPAID = new Set(["awaiting_payment", "payment_abandoned"]);

export async function buildForYou(email: string): Promise<ForYouData> {
  const db = adminClient();
  const all = await fetchProductsLite();
  const byId = new Map(all.map((p) => [p.id, p]));
  const empty: ForYouData = { ordered: [], viewed: [], brands: [], recommended: [], keywords: [] };
  if (!db || !email) return empty;

  // ── 1. Previously ordered (recency order, deduped) ──
  const { data: orders } = await db
    .from("orders")
    .select("items, status, created_at")
    .ilike("email", email)
    .order("created_at", { ascending: false })
    .limit(100);
  const orderedIds: string[] = [];
  for (const o of orders ?? []) {
    if (UNPAID.has(o.status)) continue;
    for (const it of (o.items ?? []) as { id?: string }[]) {
      if (it.id && !orderedIds.includes(it.id)) orderedIds.push(it.id);
    }
  }
  const ordered = orderedIds.map((id) => byId.get(id)).filter(Boolean) as Product[];

  // ── 2. Their devices (identify events tie sids to the email) ──
  const { data: idents } = await db
    .from("site_events")
    .select("sid")
    .eq("type", "identify")
    .ilike("email", email)
    .limit(200);
  const sids = [...new Set((idents ?? []).map((r) => r.sid))];

  // ── 3. Previously viewed (their sids' catalogue pageviews, newest first) ──
  const viewedIds: string[] = [];
  if (sids.length) {
    const { data: views } = await db
      .from("site_events")
      .select("path, created_at")
      .eq("type", "pageview")
      .like("path", "/catalogue/%")
      .in("sid", sids)
      .order("created_at", { ascending: false })
      .limit(600);
    for (const v of views ?? []) {
      const id = (v.path ?? "").split("?")[0].split("/")[2];
      if (id && !viewedIds.includes(id)) viewedIds.push(id);
    }
  }
  const viewed = viewedIds.map((id) => byId.get(id)).filter(Boolean) as Product[];

  // ── 4. Their search keywords ──
  let keywords: string[] = [];
  if (sids.length) {
    const { data: searches } = await db
      .from("search_queries")
      .select("normalized")
      .in("session_id", sids)
      .order("created_at", { ascending: false })
      .limit(200);
    const freq = new Map<string, number>();
    for (const s of searches ?? []) {
      for (const t of (s.normalized ?? "").split(/\s+/)) {
        if (t.length >= 3) freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    keywords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
  }

  // ── 5. Brands you love (orders weigh 3x a view) ──
  const brandScore = new Map<string, number>();
  for (const p of ordered) brandScore.set(p.brand, (brandScore.get(p.brand) ?? 0) + 3);
  for (const p of viewed) brandScore.set(p.brand, (brandScore.get(p.brand) ?? 0) + 1);
  const brands = [...brandScore.entries()].sort((a, b) => b[1] - a[1]).map(([b]) => b);

  // ── 6. Recommended ──
  const cats = new Map<string, number>();
  for (const p of [...ordered, ...ordered, ...viewed]) cats.set(p.cat, (cats.get(p.cat) ?? 0) + 1);
  const topCats = new Set([...cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c]) => c));
  const catRanks = getCategoryRanks();
  const ownedFamilies = new Set(ordered.map((p) => p.parentId ?? p.id));
  const kw = keywords.slice(0, 8);

  const candidates = all.filter(
    (p) => topCats.has(p.cat) && p.inStock !== false && !ownedFamilies.has(p.parentId ?? p.id)
  );
  const score = (p: Product) => {
    const editorial = Object.fromEntries(Object.entries(catRanks[p.cat] ?? {}));
    let s = visibilityScore(p, { editorialRank: editorial });
    const name = p.name.toLowerCase();
    for (const t of kw) if (name.includes(t)) s += 15;
    if (brands.slice(0, 3).includes(p.brand)) s += 10;
    return s;
  };
  const scored = new Map(candidates.map((p) => [p.id, score(p)]));
  const recommended = diversify(
    [...candidates].sort((a, b) => scored.get(b.id)! - scored.get(a.id)!),
    30, 4
  );

  return { ordered, viewed, brands, recommended, keywords };
}
