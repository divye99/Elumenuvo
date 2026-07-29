import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProductsLite } from "@/lib/products";
import { getEditorialPicks } from "@/lib/blog";
import { glanceViews30d } from "@/lib/glance";
import { loadSearchSignals } from "@/lib/search-signals";
import { rankProducts, diversify, type RankSignals } from "@/lib/ranking";
import CollectionBrowser from "@/components/storefront/CollectionBrowser";
import type { Product } from "@/lib/data";

/**
 * Collection pages - Best sellers / Top rated / New releases / Today's best
 * prices. NOT another flat catalogue grid: each category gets ONE horizontal
 * top-10 rail, so a visitor scans the whole store one row per category, and
 * the filters live in a left rail that stays frozen while the page scrolls.
 *
 * ISR like the catalogue: identical for everyone, cheap for Googlebot, and
 * the glance-view signal is read once per revalidation, not per visitor.
 */
export const revalidate = 300;
export async function generateStaticParams() {
  return KINDS.map((kind) => ({ kind }));
}

const KINDS = ["best-sellers", "top-rated", "new-releases", "best-prices"] as const;
type Kind = (typeof KINDS)[number];

const META: Record<Kind, { title: string; blurb: string; description: string }> = {
  "best-sellers": {
    title: "Best sellers",
    blurb: "What India actually buys from us - ranked by real orders, with recorded shopper interest breaking ties.",
    description: "Elume's best-selling electrical goods by category: wires, MCBs, fans, lighting and modular switches ranked by real orders.",
  },
  "top-rated": {
    title: "Top rated",
    blurb: "The products our buying guides rank highest - every pick links to the guide that explains why.",
    description: "Top-rated electrical products on Elume, anchored to our editorial buying guides and customer reviews.",
  },
  "new-releases": {
    title: "New releases",
    blurb: "The latest additions to the catalogue, newest first - fresh stock from every brand we carry.",
    description: "New electrical products on Elume: the latest wires, switchgear, fans and lighting added to the catalogue.",
  },
  "best-prices": {
    title: "Today's best prices",
    blurb: "The deepest genuine discounts off MRP right now, one rail per category. No inflated MRPs, no fake percentages.",
    description: "Today's best prices on electrical goods at Elume - the biggest genuine discounts off MRP by category.",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  const m = META[kind as Kind];
  if (!m) return {};
  return {
    title: `${m.title} - electrical goods`,
    description: m.description,
    alternates: { canonical: `https://elumenuvo.com/collections/${kind}` },
  };
}

/** Order products for one collection kind (already OOS-filtered). */
function orderFor(kind: Kind, list: Product[], signals: RankSignals): Product[] {
  switch (kind) {
    case "best-sellers":
      // Real sales first; glance views break ties; general score after that.
      return rankProducts(list, signals).sort((a, b) => {
        const ua = a.unitsSold ?? 0, ub = b.unitsSold ?? 0;
        if (ua !== ub) return ub - ua;
        const ga = signals.glanceViews?.[a.id] ?? 0, gb = signals.glanceViews?.[b.id] ?? 0;
        if (ga !== gb) return gb - ga;
        return 0; // keep rankProducts order
      });
    case "top-rated": {
      // Follows the blogs: ONLY products that hold an editorial rank in a
      // buying guide (or a real customer rating) appear here at all.
      const er = signals.editorialRank ?? {};
      return rankProducts(list, signals)
        .filter((p) => er[p.id] != null || (p.rating ?? 0) > 0)
        .sort((a, b) => {
          const ra = er[a.id] ?? 99, rb = er[b.id] ?? 99;
          if (ra !== rb) return ra - rb;
          return (b.rating ?? 0) * (b.ratingCount ?? 0) - (a.rating ?? 0) * (a.ratingCount ?? 0);
        });
    }
    case "new-releases":
      return [...list].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    case "best-prices":
      return [...list]
        .filter((p) => p.market > p.price)
        .sort((a, b) => (1 - b.price / b.market) - (1 - a.price / a.market));
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) notFound();
  const k = kind as Kind;

  const [products, gv, search] = await Promise.all([fetchProductsLite(), glanceViews30d(), loadSearchSignals()]);
  const picks = getEditorialPicks();
  const signals: RankSignals = {
    glanceViews: gv,
    editorialRank: Object.fromEntries(Object.entries(picks).map(([id, p]) => [id, p.rank])),
    searchBoost: search.pickTotals,
  };

  // Rule 1 applied hard here: a curated top-10 rail never shows what cannot
  // be bought. (The main catalogue still lists OOS items, sunk to the end.)
  const buyable = products.filter((p) => p.inStock !== false);

  // One rail per category; rail order = how much buyable demand the category has.
  const byCat = new Map<string, Product[]>();
  for (const p of buyable) (byCat.get(p.cat) ?? byCat.set(p.cat, []).get(p.cat)!).push(p);
  const rails = [...byCat.entries()]
    .map(([cat, list]) => {
      // For top-rated, only categories with actual editorial/reviewed products earn a rail.
      const ordered = orderFor(k, list, signals);
      const top = diversify(ordered, 10, 3).slice(0, 10);
      return { cat, items: top };
    })
    .filter((r) => r.items.length >= (k === "top-rated" ? 3 : 4))
    .sort((a, b) => b.items.reduce((s, p) => s + (p.unitsSold ?? 0), 0) - a.items.reduce((s, p) => s + (p.unitsSold ?? 0), 0));

  const brands = [...new Set(buyable.map((p) => p.brand))].sort();

  return <CollectionBrowser kind={k} title={META[k].title} blurb={META[k].blurb} rails={rails} brands={brands} />;
}
