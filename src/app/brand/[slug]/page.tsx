import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HubBrowser, { type FacetTreeGroup } from "@/components/storefront/HubBrowser";
import NorisysBrandExperience from "@/components/storefront/NorisysBrandExperience";
import { norisysCode, norisysFinishFamily, norisysFinishLabel, norisysSeries } from "@/lib/norisys";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";

/** Brand hub: /brand/havells, /brand/rr-kabel ... Trending / Top rated /
 *  Best sellers rails for the brand, then its whole catalogue with the
 *  frozen filter rail (categories) and floating sort header. */
// 1h window (was 5min - Vercel ISR-write blowout, Aug 2026); product changes
// revalidate on demand via the products cache tag, so this is only a safety net.
export const revalidate = 3600;
/** All brand slugs are enumerated at build, and dynamicParams=false makes
 *  any unknown slug 404 at the ROUTER level - before streaming starts - so
 *  the loading skeleton cannot soft-404 a junk URL. New brands arrive via
 *  our own import deploys, so the list is fresh by construction. */
export const dynamicParams = false;
export async function generateStaticParams() {
  const all = await fetchProductsLite();
  return [...new Set(all.map((p) => p.brand))].map((v) => ({ slug: slugify(v) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const brand = resolveSlug(slug, [...new Set(all.map((p) => p.brand))]);
  if (!brand) notFound(); // guard: streams behind a skeleton, so 404 must be decided in metadata
  // Commercial SERP pattern (owner ask, Aug 2026): brand queries are buying
  // queries - the title should read like a shop, not a directory entry, and
  // carry the brand's real categories and count from live data.
  const mine = all.filter((p) => p.brand === brand);
  const cats = [...new Set(mine.map((p) => p.cat))].slice(0, 4);
  return {
    title: `Buy ${brand} Products Online at Best Prices in India (${mine.length}+ items)`,
    description: `Shop ${brand} ${cats.map((c) => c.toLowerCase()).join(", ")} online at market-beating prices. Genuine ${brand} products with GST invoice, live price tracking and free pan-India delivery above ₹4,000.`,
    alternates: { canonical: `https://elumenuvo.com/brand/${slugify(brand)}` },
  };
}

export default async function BrandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const brand = resolveSlug(slug, [...new Set(all.map((p) => p.brand))]);
  if (!brand) notFound();

  const hub = await buildHub((p) => p.brand === brand, false);
  const cats = [...new Set(hub.products.map((p) => p.cat))].sort();

  // Norisys: Series and a two-level Finish tree join Category in the standard
  // filter rail, derived from the catalogue code in each product's name (see
  // lib/norisys). Finish stays compact: 6 material families at the top, and
  // ticking one reveals its tones (owner, Aug 2026).
  let seriesOf: Record<string, string> | undefined;
  let seriesList: string[] | undefined;
  let finishOf: Record<string, string> | undefined;
  let finishTree: FacetTreeGroup[] | undefined;
  if (brand === "Norisys") {
    seriesOf = {};
    finishOf = {};
    const seriesCounts = new Map<string, number>();
    const famTones = new Map<string, Map<string, { value: string; count: number }>>();
    for (const p of hub.products) {
      const code = norisysCode(p);
      if (!code) continue;
      const s = norisysSeries(code.stem);
      seriesOf[p.id] = s;
      seriesCounts.set(s, (seriesCounts.get(s) ?? 0) + 1);
      const label = norisysFinishLabel(p, code);
      finishOf[p.id] = label;
      const { family, tone } = norisysFinishFamily(label);
      if (!famTones.has(family)) famTones.set(family, new Map());
      const tones = famTones.get(family)!;
      const t = tones.get(tone || family) ?? { value: label, count: 0 };
      t.count += 1;
      tones.set(tone || family, t);
    }
    seriesList = [...seriesCounts.keys()].sort();
    const FAMILY_ORDER = ["Solid Glass", "Solid Aluminium", "Solid Wood", "Solid Marble", "Solid Metal", "Colours"];
    finishTree = [...famTones.entries()]
      .sort((a, b) => FAMILY_ORDER.indexOf(a[0]) - FAMILY_ORDER.indexOf(b[0]))
      .map(([family, tones]) => ({
        group: family,
        subs: [...tones.entries()]
          .sort((a, b) => b[1].count - a[1].count)
          .map(([toneLabel, t]) => ({ value: t.value, label: toneLabel })),
      }));
  }

  // Shop by category: our category icons in circles; each lands on that
  // category's hub pre-filtered to THIS brand.
  const strip = cats.map((c) => ({
    label: c,
    cat: c,
    href: `/category/${slugify(c)}?facet=${encodeURIComponent(brand!)}`,
  }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://elumenuvo.com" },
      { "@type": "ListItem", position: 2, name: brand },
    ],
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    {/* Norisys flagship-store header (owner, Aug 2026) - Norisys only. */}
    {brand === "Norisys" && (
      <div style={{ maxWidth: 1240, margin: "18px auto 0", padding: "0 24px" }}>
        <NorisysBrandExperience />
      </div>
    )}
    <HubBrowser
        title={brand}
        subtitle={`Buy genuine ${brand} ${cats.slice(0, 3).map((c) => c.toLowerCase()).join(", ")} and more online: trending picks first, the full range below, every price checked against the open market, with GST invoice and free pan-India delivery above ₹4,000.`}
        hideHeader={brand === "Norisys"}
        rails={hub.rails.filter((r) => ["trending", "top-rated", "best-sellers"].includes(r.key))}
        strip={strip}
        stripTitle="Shop by category"
        products={hub.products}
        facetLabel="Category"
        facets={cats}
        facet2Label={seriesList && seriesList.length > 1 ? "Series" : undefined}
        facets2={seriesList}
        facet2Of={seriesOf}
        facetTreeLabel={finishTree ? "Finish" : undefined}
        facetTree={finishTree}
        facetTreeOf={finishOf}
    />
    </>
  );
}
