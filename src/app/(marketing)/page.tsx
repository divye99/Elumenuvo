import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import HomeStorefront from "@/components/storefront/HomeStorefront";
import { fetchProducts } from "@/lib/products";
import { getAllPosts } from "@/lib/blog";
import { WEBSITE } from "@/lib/seo";
import { jsonLd as toJsonLd } from "@/lib/jsonld";

/**
 * ISR, not force-dynamic. The homepage is the most bot-hammered URL on the
 * site, and rendering it per-request pulled the full 1.9 MB product table
 * from Supabase on every hit - the #1 cause of the egress blowout. Cached
 * for ≤5 min; every admin catalogue write revalidates "/" instantly via
 * revalidateTag/revalidatePath, so price and stock edits are never stale.
 * Personalised shelves stay client-side (PersonalRails), so caching the
 * page costs no personalisation. 1h window (was 5min - Vercel ISR-write
 * blowout, Aug 2026); price/stock changes revalidate "/" on demand anyway.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Elume - Buy electrical goods online in India | Wires, MCBs, Switches, Fans, Lights",
  description:
    "India's FMEG store: house wires, MCBs & switchgear, modular switches, distribution boards, fans and LED lighting from Havells, Polycab, Finolex, CMI and more. MRP, Elume price and wholesale rates on every product.",
  alternates: { canonical: "https://elumenuvo.com" },
  openGraph: {
    siteName: "Elume",
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }],
    title: "Elume - Buy electrical goods online in India",
    description: "Every electrical brand. One transparent price list.",
    url: "https://elumenuvo.com",
    type: "website",
  },
};

export default async function Page() {
  const products = await fetchProducts();
  return (
    <StoreChrome>
      {/* Homepage only: this is what makes Google print "Elume" above a search
          result instead of "elumenuvo.com". Google reads the site name from
          the root document and applies it across the domain, so it must not be
          duplicated onto other pages. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(WEBSITE) }} />
      <HomeStorefront products={products} posts={getAllPosts()} />
    </StoreChrome>
  );
}
