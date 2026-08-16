import type { Metadata } from "next";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import { notFound, permanentRedirect } from "next/navigation";
import { fetchProduct, fetchFamily, fetchProductByElin } from "@/lib/products";
import { isElin, normalizeElin } from "@/lib/elin";
import { getEditorialPicks } from "@/lib/blog";
import Link from "next/link";
import { fetchReviews } from "@/lib/reviews";
import { fetchPriceHistory } from "@/lib/competitor-history";
import { fetchFullPriceHistory } from "@/lib/metals-history";
import { isMetalCategory, lotKg } from "@/lib/metals";
import { gstRateFor } from "@/lib/pricing";
import CompetitorPriceChart from "@/components/storefront/CompetitorPriceChart";
import MetalsRateChart from "@/components/metals/MetalsRateChart";
import MetalsMarketCharts from "@/components/metals/MetalsMarketCharts";
import ElumeFlagship from "@/components/storefront/ElumeFlagship";
import { productDescription } from "@/lib/seo-description";
import { getAllPosts, CATEGORY_TO_CATALOGUE } from "@/lib/blog";
import PublicProductView from "@/components/storefront/PublicProductView";
import PdpTelemetry from "@/components/storefront/PdpTelemetry";
import ProductDeepDive from "@/components/storefront/ProductDeepDive";
import ReviewsSection from "@/components/storefront/ReviewsSection";
import ProductFaq from "@/components/storefront/ProductFaq";
import { NEW_CONDITION, RETURN_POLICY, shippingDetailsFor, productFaqs } from "@/lib/seo";
import { slugify } from "@/lib/slug";
import CompareRail from "@/components/storefront/CompareRail";
import PersonalRailsLazy from "@/components/storefront/PersonalRails";
import { fetchCompareRail } from "@/lib/compare/rail";

// ISR, not dynamic. Product pages are the same for every visitor, so they are
// generated once and served from cache: Googlebot gets bytes instead of a
// database round-trip, which is what lets it work through 7,600+ URLs. Price
// and stock edits call revalidatePath/revalidateTag on the exact product, so
// a cached page is replaced the moment it stops being true - the window below
// is only a safety net. It is set LONG deliberately (Vercel free-tier blowout,
// Aug 2026): at 5 minutes, every crawler visit to an expired PDP was an ISR
// write + a full render, 600K+ writes/month across the catalogue. Do not
// shorten it - on-demand revalidation carries all freshness.
export const revalidate = 86400;

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

/** ELIN URLs resolve for every product: new imports use the ELIN AS the id,
 *  and for older products /catalogue/<ELIN> 301s to the canonical slug URL
 *  (existing URLs stay indexed - no re-crawl churn, owner decision Aug 2026). */
async function resolveOrRedirect(id: string) {
  const p = await fetchProduct(id);
  if (p) return p;
  if (isElin(id)) {
    const byElin = await fetchProductByElin(normalizeElin(id));
    if (byElin) permanentRedirect(`/catalogue/${encodeURIComponent(byElin.id)}`);
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const p = await resolveOrRedirect(id);
  // notFound() HERE, not only in the page: metadata resolves before the
  // response streams, so a missing product 404s even though the page body
  // now streams behind a loading skeleton. (The skeleton is exactly the
  // mechanism that caused the old soft-404 bug - this line is the guard.)
  if (!p) notFound();
  // Buy-intent title with the live price (owner SEO push, Aug 2026): price in
  // the SERP title is the single biggest CTR lever for product queries, and
  // it re-renders with the page whenever the price changes.
  const title = `${p.name} - Buy ${p.brand} Online at ₹${Math.round(p.price).toLocaleString("en-IN")}`;
  const description = productDescription(p);
  const url = `${SITE}/catalogue/${p.id}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
    siteName: "Elume", title, description, url, type: "website", images: p.image ? [absImage(p.image)!] : undefined },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await resolveOrRedirect(id);
  const pick = product ? getEditorialPicks()[product.id] ?? null : null;
  if (!product) notFound();

  // Family = parent + all variations, whichever member this page is.
  const isMetal = isMetalCategory(product.cat);
  const [siblings, reviews, priceHistory, fullHistory, compare] = await Promise.all([
    fetchFamily(product),
    fetchReviews(product.id),
    isMetal ? Promise.resolve([]) : fetchPriceHistory(product.id, product.price),
    // Metals get the full capture-level series: the rate moves 2-3x a day by
    // design, so the 24h chart needs every point, and 5Y needs the whole run.
    isMetal ? fetchFullPriceHistory(product.id, product.price) : Promise.resolve([]),
    isMetal ? Promise.resolve(null) : fetchCompareRail(product.id),
  ]);
  const guide = getAllPosts().find((post) => CATEGORY_TO_CATALOGUE[post.category] === product.cat) ?? null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    category: product.cat,
    brand: { "@type": "Brand", name: product.brand },
    description: productDescription(product),
    // schema.org wants the property ABSENT for photo-less products, never [].
    image: (() => {
      const arr = (product.images?.length ? product.images : product.image ? [product.image] : []).map((u) => absImage(u)!);
      return arr.length ? arr.slice(0, 8) : undefined;
    })(),
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
      shippingDetails: shippingDetailsFor(product.price, product.shipWeightKg),
    },
  };
  const faqs = productFaqs({ name: product.name, brand: product.brand, unit: product.unit });

  // Breadcrumb trail for the SERP (Home > Category > Product) - Google shows
  // it under the title and it reinforces the category hub's authority.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: product.cat, item: `${SITE}/category/${slugify(product.cat)}` },
      { "@type": "ListItem", position: 3, name: product.name },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(breadcrumbLd) }} />
      <PdpTelemetry pid={product.id} />
      <PublicProductView
        p={product}
        siblings={siblings}
        abovePrice={pick ? (
          // Explicit key: this element is passed as a PROP and rendered inside
          // an array in ProductDetail - without a key React logs the unique-key
          // warning on every PDP that has an editorial pick.
          <a key="editorial-pick" href={`/blog/${pick.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#137a4b", margin: "0 0 10px", borderBottom: "1px dashed #9ECBB1", paddingBottom: 2, width: "fit-content", maxWidth: "100%" }}>
            ⚡ Ranked #{pick.rank} in {pick.postTitle.replace(/ \(2026\).*$/, "")} · {pick.bestFor.replace(/^Best for:?\s*/i, "")} →
          </a>
        ) : undefined}
      />
      {product.brand === "Elume" && (
        <div className="pdp-wrap" style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
          <ElumeFlagship p={product} />
        </div>
      )}
      {isMetal ? (
        <div data-pdp-sec="price-history" className="pdp-wrap" style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px", display: "flex", flexDirection: "column", gap: 18 }}>
          <MetalsRateChart
            points={fullHistory}
            gstRate={gstRateFor(product.cat, product.gstRate)}
            kgPerUnit={lotKg(product.attrs)}
          />
          <MetalsMarketCharts />
        </div>
      ) : (
        <div data-pdp-sec="price-history" className="pdp-wrap" style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
          <CompetitorPriceChart series={priceHistory} mrp={product.market} />
        </div>
      )}
      {/* "Often bought together" - client-personalised, hidden when the
          co-purchase graph has nothing for this product. */}
      {!isMetal && (
        <div className="pdp-wrap" style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 30px" }}>
          <PersonalRailsLazy ctx={`pdp:${product.id}`} />
        </div>
      )}
      {/* Like-to-like alternatives - renders nothing when no group matches. */}
      {compare && (
        <CompareRail
          current={{
            id: product.id, name: product.name, brand: product.brand, price: product.price,
            mrp: product.market, unit: product.unit, cat: product.cat, gstRate: product.gstRate,
            image: product.image, display: compare.currentDisplay,
          }}
          items={compare.items}
          pageSlug={compare.pageSlug}
        />
      )}
      <div style={{ height: 18 }} />
      <ProductDeepDive p={product} siblings={siblings} post={guide} />
      <div style={{ height: 18 }} />
      <ProductFaq faqs={faqs} />
      <div style={{ height: 18 }} />
      <ReviewsSection productId={product.id} reviews={reviews} />
    </>
  );
}
