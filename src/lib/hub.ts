import type { Product } from "@/lib/data";
import { fetchProductsLite } from "@/lib/products";
import { getEditorialPicks } from "@/lib/blog";
import { glanceViews30d } from "@/lib/glance";
import { loadSearchSignals } from "@/lib/search-signals";
import { rankProducts, diversify, type RankSignals } from "@/lib/ranking";

/**
 * Shared data assembly for the brand and category hub pages: the scoped
 * product list in trending order (OOS sunk by the ranking gate) plus the
 * three rails - Trending / Top rated / Best sellers - built from buyable
 * products only. A rail with fewer than 3 items is dropped by the UI.
 */
export type HubData = {
  products: Product[];
  rails: { key: string; label: string; blurb: string; items: Product[] }[];
};

export async function buildHub(scope: (p: Product) => boolean, spreadBrands: boolean): Promise<HubData> {
  const [all, gv, search] = await Promise.all([fetchProductsLite(), glanceViews30d(), loadSearchSignals()]);
  const picks = getEditorialPicks();
  const signals: RankSignals = {
    glanceViews: gv,
    editorialRank: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, p.rank])),
    searchBoost: search.pickTotals,
  };

  const scoped = all.filter(scope);
  const trendingAll = rankProducts(scoped, signals); // OOS sinks via the score gate
  const buyable = trendingAll.filter((p) => p.inStock !== false);
  const spread = (l: Product[]) => (spreadBrands ? diversify(l, 10, 3) : l);

  const bestSellers = [...buyable].sort((a, b) => {
    const ua = a.unitsSold ?? 0, ub = b.unitsSold ?? 0;
    if (ua !== ub) return ub - ua;
    return (gv[b.id] ?? 0) - (gv[a.id] ?? 0);
  });
  const er = signals.editorialRank!;
  const topRated = buyable
    .filter((p) => er[p.id] != null || (p.rating ?? 0) > 0)
    .sort((a, b) => (er[a.id] ?? 99) - (er[b.id] ?? 99) || (b.rating ?? 0) - (a.rating ?? 0));

  return {
    products: trendingAll,
    rails: [
      { key: "trending", label: "Trending", blurb: "what shoppers are looking at right now", items: spread(buyable).slice(0, 10) },
      { key: "top-rated", label: "Top rated", blurb: "ranked by our buying guides and reviews", items: spread(topRated).slice(0, 10) },
      { key: "best-sellers", label: "Best sellers", blurb: "ranked by real orders", items: spread(bestSellers).slice(0, 10) },
    ],
  };
}
