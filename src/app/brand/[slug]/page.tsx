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
  return {
    title: `${brand} - all products, best prices`,
    description: `Shop the full ${brand} range on Elume: trending products, top rated picks and best sellers, with transparent pricing and free pan-India delivery.`,
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

  return (
    <HubBrowser
        title={brand}
        subtitle={`Every ${brand} product we stock - trending picks first, the full range below, all at our usual market-beating prices.`}
        rails={hub.rails.filter((r) => ["trending", "top-rated", "best-sellers"].includes(r.key))}
        strip={strip}
        stripTitle="Shop by category"
        products={hub.products}
        facetLabel="Category"
        facets={cats}
    />
  );
}
