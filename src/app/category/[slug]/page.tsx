import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HubBrowser from "@/components/storefront/HubBrowser";
import { fetchProductsLite } from "@/lib/products";
import { buildHub } from "@/lib/hub";
import { resolveSlug, slugify } from "@/lib/slug";
import { brandLogo } from "@/lib/brand-logos";

/** Category hub: /category/fans, /category/wires-cables ... Trending /
 *  Top rated / Best sellers rails for the category (brand-spread so no one
 *  brand walls the rail), then the whole category with the frozen filter
 *  rail (brands) and floating sort header. */
export const revalidate = 300;
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

  // Shop by brand: circular logo strip; each circle lands on that brand's hub
  // pre-filtered to THIS category (brand+category as one combined filter).
  const strip = brands.map((b) => ({
    label: b,
    img: brandLogo(b),
    href: `/brand/${slugify(b)}?facet=${encodeURIComponent(cat!)}`,
  }));

  return (
    <HubBrowser
        title={cat}
        subtitle={`All ${cat.toLowerCase()} across every brand we stock - trending picks first, the full range below.`}
        rails={hub.rails}
        strip={strip}
        stripTitle="Shop by brand"
        products={hub.products}
        facetLabel="Brand"
        facets={brands}
    />
  );
}
