import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HubBrowser from "@/components/storefront/HubBrowser";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";
import { brandLogo } from "@/lib/brand-logos";
import { CATEGORY_INTROS } from "@/lib/category-intros";

/** Category hub: /category/fans, /category/wires-cables ... Trending /
 *  Top rated / Best sellers rails for the category (brand-spread so no one
 *  brand walls the rail), then the whole category with the frozen filter
 *  rail (brands) and floating sort header. */
// 1h window (was 5min - Vercel ISR-write blowout, Aug 2026); product changes
// revalidate on demand via the products cache tag, so this is only a safety net.
export const revalidate = 3600;
/** All category slugs are enumerated at build, and dynamicParams=false makes
 *  any unknown slug 404 at the ROUTER level - before streaming starts - so
 *  the loading skeleton cannot soft-404 a junk URL. New categorys arrive via
 *  our own import deploys, so the list is fresh by construction. */
export const dynamicParams = false;
export async function generateStaticParams() {
  const all = await fetchProductsLite();
  return [...new Set(all.map((p) => p.cat))].map((v) => ({ slug: slugify(v) }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const cat = resolveSlug(slug, [...new Set(all.map((p) => p.cat))]);
  if (!cat) notFound(); // guard: streams behind a skeleton, so 404 must be decided in metadata
  // Commercial SERP pattern (owner ask, Aug 2026): category queries are buying
  // queries - lead with "Buy ... Online", name the top brands from live data.
  const mine = all.filter((p) => p.cat === cat);
  const brandCount = new Map<string, number>();
  for (const p of mine) brandCount.set(p.brand, (brandCount.get(p.brand) ?? 0) + 1);
  const topBrands = [...brandCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([b]) => b);
  return {
    title: `Buy ${cat} Online at Best Prices in India - ${topBrands.join(", ")} & more`,
    description: `Shop ${mine.length}+ ${cat.toLowerCase()} across ${brandCount.size} brands at market-beating prices: trending, top rated and best sellers with GST invoice and free pan-India delivery above ₹4,000.`,
    alternates: { canonical: `https://elumenuvo.com/category/${slugify(cat)}` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const cat = resolveSlug(slug, [...new Set(all.map((p) => p.cat))]);
  if (!cat) notFound();

  const hub = await buildHub((p) => p.cat === cat, true);
  const brands = [...new Set(hub.products.map((p) => p.brand))].sort();

  // Shop by brand: circular logo strip; each circle lands on that brand's hub
  // pre-filtered to THIS category (brand+category as one combined filter).
  const strip = brands.map((b) => ({
    label: b,
    img: brandLogo(b),
    href: `/brand/${slugify(b)}?facet=${encodeURIComponent(cat!)}`,
  }));

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://elumenuvo.com" },
      { "@type": "ListItem", position: 2, name: cat },
    ],
  };

  return (
    <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
    <HubBrowser
        title={cat}
        subtitle={CATEGORY_INTROS[cat] ?? `All ${cat.toLowerCase()} across every brand we stock - trending picks first, the full range below.`}
        rails={hub.rails}
        strip={strip}
        stripTitle="Shop by brand"
        products={hub.products}
        facetLabel="Brand"
        facets={brands}
    />
    </>
  );
}
