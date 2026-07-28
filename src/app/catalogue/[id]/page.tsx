import type { Metadata } from "next";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import { notFound } from "next/navigation";
import { fetchProduct, fetchFamily } from "@/lib/products";
import { getEditorialPicks } from "@/lib/blog";
import Link from "next/link";
import { fetchReviews } from "@/lib/reviews";
import { fetchPriceHistory } from "@/lib/competitor-history";
import CompetitorPriceChart from "@/components/storefront/CompetitorPriceChart";
import ElumeFlagship from "@/components/storefront/ElumeFlagship";
import { wholesalePrice } from "@/lib/pricing";
import { getAllPosts, CATEGORY_TO_CATALOGUE } from "@/lib/blog";
import PublicProductView from "@/components/storefront/PublicProductView";
import ProductDeepDive from "@/components/storefront/ProductDeepDive";
import ReviewsSection from "@/components/storefront/ReviewsSection";
import ProductFaq from "@/components/storefront/ProductFaq";
import { NEW_CONDITION, RETURN_POLICY, SHIPPING_DETAILS, productFaqs } from "@/lib/seo";

// ISR, not dynamic. Product pages are the same for every visitor, so they are
// generated once and served from cache: Googlebot gets bytes instead of a
// database round-trip, which is what lets it work through 3,400+ URLs. Price
// and stock edits call revalidatePath on the exact product, so a cached page
// is replaced the moment it stops being true rather than waiting out the
// window below.
export const revalidate = 300;

/** Empty on purpose. A dynamic segment with no generateStaticParams renders on
 *  demand EVERY time; declaring it (with dynamicParams left on) makes the route
 *  statically generated instead - each product is rendered the first time it is
 *  requested and then served from cache. Returning [] keeps builds fast: we do
 *  not prerender 3,400+ pages up front, we let them fill in on first visit. */
export async function generateStaticParams() {
  return [];
}

const SITE = "https://elumenuvo.com";

/** Image URLs stored as site-relative paths (/products/x.jpg) need the origin
 *  prefixed for OG tags and JSON-LD. */
const absImage = (u?: string) => (u ? (u.startsWith("http") ? u : `${SITE}${u}`) : undefined);

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
    openGraph: { title, description, url, type: "website", images: p.image ? [absImage(p.image)!] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchProduct(id);
  const pick = product ? getEditorialPicks()[product.id] ?? null : null;
  if (!product) notFound();

  // Family = parent + all variations, whichever member this page is.
  const [siblings, reviews, priceHistory] = await Promise.all([
    fetchFamily(product),
    fetchReviews(product.id),
    fetchPriceHistory(product.id, product.price),
  ]);
  const guide = getAllPosts().find((post) => CATEGORY_TO_CATALOGUE[post.category] === product.cat) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    category: product.cat,
    brand: { "@type": "Brand", name: product.brand },
    description: product.spec || product.name,
    image: product.image ? [absImage(product.image)!] : undefined,
    aggregateRating:
      product.rating && product.ratingCount
        ? { "@type": "AggregateRating", ratingValue: product.rating, reviewCount: product.ratingCount }
        : undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE}/catalogue/${product.id}`,
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock === false ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: NEW_CONDITION,
      areaServed: { "@type": "Country", name: "India" },
      seller: { "@type": "Organization", name: "Elume Nuvotech Private Limited" },
      hasMerchantReturnPolicy: RETURN_POLICY,
      shippingDetails: SHIPPING_DETAILS,
    },
  };
  const faqs = productFaqs({ name: product.name, brand: product.brand, unit: product.unit });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <PublicProductView
        p={product}
        siblings={siblings}
        abovePrice={pick ? (
          <a href={`/blog/${pick.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#137a4b", margin: "0 0 10px", borderBottom: "1px dashed #9ECBB1", paddingBottom: 2, width: "fit-content", maxWidth: "100%" }}>
            ⚡ Ranked #{pick.rank} in {pick.postTitle.replace(/ \(2026\).*$/, "")} · {pick.bestFor.replace(/^Best for:?\s*/i, "")} →
          </a>
        ) : undefined}
      />
      {product.brand === "Elume" && (
        <div style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
          <ElumeFlagship p={product} />
        </div>
      )}
      <div style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
        <CompetitorPriceChart series={priceHistory} mrp={product.market} />
      </div>
      <div style={{ height: 18 }} />
      <ProductDeepDive p={product} siblings={siblings} post={guide} />
      <div style={{ height: 18 }} />
      <ProductFaq faqs={faqs} />
      <div style={{ height: 18 }} />
      <ReviewsSection productId={product.id} reviews={reviews} />
    </>
  );
}
