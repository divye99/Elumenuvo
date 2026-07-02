import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchProduct, fetchFamily } from "@/lib/products";
import { fetchReviews } from "@/lib/reviews";
import { wholesalePrice } from "@/lib/pricing";
import { getAllPosts, CATEGORY_TO_CATALOGUE } from "@/lib/blog";
import PublicProductView from "@/components/storefront/PublicProductView";
import ProductDeepDive from "@/components/storefront/ProductDeepDive";
import ReviewsSection from "@/components/storefront/ReviewsSection";

export const dynamic = "force-dynamic";

const SITE = "https://elumenuvo.com";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProduct(id);
  if (!p) return {};
  const title = `${p.name} — ${p.brand}`;
  const description = `${p.name} by ${p.brand}${p.spec ? ` (${p.spec})` : ""}. Elume price ₹${p.price} per ${p.unit} (MRP ₹${p.market}), wholesale ₹${wholesalePrice(p.price)} at 15+ units. Buy electrical goods online in India.`;
  const url = `${SITE}/catalogue/${p.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", images: p.image ? [p.image] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) notFound();

  // Family = parent + all variations, whichever member this page is.
  const [siblings, reviews] = await Promise.all([fetchFamily(product), fetchReviews(product.id)]);
  const guide = getAllPosts().find((post) => CATEGORY_TO_CATALOGUE[post.category] === product.cat) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    category: product.cat,
    brand: { "@type": "Brand", name: product.brand },
    description: product.spec || product.name,
    image: product.image ? [product.image] : undefined,
    aggregateRating:
      product.rating && product.ratingCount
        ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.ratingCount }
        : undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE}/catalogue/${product.id}`,
      priceCurrency: "INR",
      price: product.price,
      availability: "https://schema.org/InStock",
      areaServed: { "@type": "Country", name: "India" },
      seller: { "@type": "Organization", name: "Elume" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PublicProductView p={product} siblings={siblings} />
      <div style={{ height: 18 }} />
      <ProductDeepDive p={product} siblings={siblings} post={guide} />
      <div style={{ height: 18 }} />
      <ReviewsSection productId={product.id} reviews={reviews} />
    </>
  );
}
