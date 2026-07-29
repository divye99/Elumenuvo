import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoreChrome from "@/components/storefront/StoreChrome";
import HubBrowser from "@/components/storefront/HubBrowser";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";

/** Category hub: /category/fans, /category/wires-cables ... Trending /
 *  Top rated / Best sellers rails for the category (brand-spread so no one
 *  brand walls the rail), then the whole category with the frozen filter
 *  rail (brands) and floating sort header. */
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const cat = resolveSlug(slug, [...new Set(all.map((p) => p.cat))]);
  if (!cat) return {};
  return {
    title: `${cat} - trending, top rated & best sellers`,
    description: `Shop ${cat.toLowerCase()} on Elume across every brand we carry: trending products, top rated picks and best sellers, with free pan-India delivery.`,
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

  return (
    <StoreChrome>
      <HubBrowser
        title={cat}
        subtitle={`All ${cat.toLowerCase()} across every brand we stock - trending picks first, the full range below.`}
        rails={hub.rails}
        products={hub.products}
        facetLabel="Brand"
        facets={brands}
      />
    </StoreChrome>
  );
}
