import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoreChrome from "@/components/storefront/StoreChrome";
import HubBrowser from "@/components/storefront/HubBrowser";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";

/** Brand hub: /brand/havells, /brand/rr-kabel ... Trending / Top rated /
 *  Best sellers rails for the brand, then its whole catalogue with the
 *  frozen filter rail (categories) and floating sort header. */
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const brand = resolveSlug(slug, [...new Set(all.map((p) => p.brand))]);
  if (!brand) return {};
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

  return (
    <StoreChrome>
      <HubBrowser
        title={brand}
        subtitle={`Every ${brand} product we stock - trending picks first, the full range below, all at our usual market-beating prices.`}
        rails={hub.rails}
        products={hub.products}
        facetLabel="Category"
        facets={cats}
      />
    </StoreChrome>
  );
}
