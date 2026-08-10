import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HubBrowser from "@/components/storefront/HubBrowser";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";
import { CAT_ICONS } from "@/lib/cat-icons";

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

  // Shop by category: our category icons in circles; each lands on that
  // category's hub pre-filtered to THIS brand.
  const strip = cats.map((c) => ({
    label: c,
    emoji: CAT_ICONS[c] ?? "•",
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
    <HubBrowser
        title={brand}
        subtitle={`Buy genuine ${brand} ${cats.slice(0, 3).map((c) => c.toLowerCase()).join(", ")} and more online: trending picks first, the full range below, every price checked against the open market, with GST invoice and free pan-India delivery above ₹4,000.`}
        rails={hub.rails.filter((r) => ["trending", "top-rated", "best-sellers"].includes(r.key))}
        strip={strip}
        stripTitle="Shop by category"
        products={hub.products}
        facetLabel="Category"
        facets={cats}
    />
    </>
  );
}
