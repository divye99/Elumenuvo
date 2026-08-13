/**
 * Shared structured-data (schema.org / JSON-LD) building blocks - reused across
 * the site so Organization, Offer policies and FAQ markup stay consistent and
 * standardised for search + AI answer engines.
 */
export const SITE = "https://elumenuvo.com";

import { COMPANY, postalAddress, postalAddressOf } from "./company";
import { shippingFeeFor, isHeavy, HEAVY_FREIGHT_FEE } from "./pricing";

/** Organization / publisher identity (add @context where embedded).
 *  A postal address and an identifier (CIN) are what turn this from a name
 *  into a verifiable business - Merchant Center's misrepresentation check
 *  looks for exactly that. Both appear as soon as they are set in company.ts. */
export const ORG = {
  "@type": "Organization",
  // `name` is the BRAND, `legalName` the registered entity. They were both the
  // legal name, which left Google with no confident brand string and it fell
  // back to showing the bare domain in search results.
  name: "Elume",
  legalName: "Elume Nuvotech Private Limited",
  alternateName: "Elume Nuvotech",
  url: SITE,
  logo: `${SITE}/assets/elume-mark.png`,
  email: "info@elumenuvo.com",
  telephone: "+919818821175",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "info@elumenuvo.com",
    telephone: "+919818821175",
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
  address: postalAddress(),
  location: [
    { "@type": "Place", name: COMPANY.registeredOffice.label, address: postalAddressOf(COMPANY.registeredOffice) },
    { "@type": "Place", name: COMPANY.additionalOffice.label, address: postalAddressOf(COMPANY.additionalOffice) },
  ],
  openingHours: COMPANY.hoursSpec,
  ...(COMPANY.cin ? { identifier: COMPANY.cin } : {}),
  ...(COMPANY.gstin ? { taxID: COMPANY.gstin } : {}),
  // Live social profiles: identity corroboration for Merchant Center and the
  // knowledge panel - the URLs must stay in sync with SOCIALS in company.ts.
  sameAs: [
    "https://www.facebook.com/profile.php?id=61592404302026",
    "https://www.instagram.com/elumenuvo/",
    "https://www.youtube.com/@ElumeNuvo",
  ] as string[],
};

/**
 * WebSite entity - the signal Google uses to print a SITE NAME above a search
 * result instead of the bare domain ("Elume", not "elumenuvo.com").
 *
 * Two rules from Google's site-name documentation drive the shape of this:
 *   1. It must appear on the HOMEPAGE. Google reads the site name from the
 *      root document and applies it to every result for the domain, so
 *      emitting this site-wide adds nothing and risks contradicting itself.
 *   2. `name` must be the short brand. `alternateName` gives Google a second
 *      accepted form without competing for the headline.
 *
 * `url` is the domain root with a trailing slash, which is what Google matches
 * the entity against.
 *
 * Expect a lag: Google only refreshes this when it next recrawls the homepage,
 * typically days to a few weeks.
 */
export const WEBSITE = {
  "@type": "WebSite",
  name: "Elume",
  alternateName: "Elume Nuvotech",
  url: `${SITE}/`,
  publisher: { "@type": "Organization", name: "Elume", url: SITE },
};

/** Standard merchant policies (pan-India, free shipping, 7-day free returns). */
export const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "IN",
  returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 7,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/FreeReturn",
};

/**
 * Shipping is tiered on order value (free at ₹4,000+, see lib/pricing), but an
 * Offer's shippingDetails describes ONE product bought on its own, so the rate
 * published is the fee a single unit of THIS product would incur. Google
 * compares this against the landing page and checkout; overstating (a flat
 * worst case) or understating (still claiming 0) both invite price-mismatch
 * disapprovals.
 */
export function shippingDetailsFor(inclusivePrice: number, shipWeightKg?: number | null) {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: shippingFeeFor(inclusivePrice) + (isHeavy(shipWeightKg) ? HEAVY_FREIGHT_FEE : 0), currency: "INR" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" },
    },
  };
}

export const NEW_CONDITION = "https://schema.org/NewCondition";

export type Faq = { q: string; a: string };

/** FAQPage JSON-LD from a Q&A list (embed the same Q&A visibly on the page). */
export function faqJsonLd(items: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Standard buyer FAQ for a product (genuineness, delivery, GST, wholesale, returns). */
export function productFaqs(p: { name: string; brand: string; unit: string }): Faq[] {
  const unit = p.unit || "unit";
  return [
    { q: `Is ${p.name} genuine and warranty-backed?`, a: `Yes. Every ${p.brand} product on Elume is 100% genuine, sourced through authorised channels, and carries the manufacturer's standard warranty.` },
    { q: "Do you deliver across India?", a: "Yes - we deliver pan-India, usually within 3–7 working days. Delivery is free on orders of ₹4,000 and above; a flat ₹100 fee applies from ₹2,000 to ₹4,000 and ₹200 below ₹2,000." },
    { q: "Can I get a GST invoice?", a: "Yes. Enter your GSTIN at checkout and we issue a GST invoice with tax shown separately, so businesses can claim input tax credit." },
    { q: "Is there a wholesale or bulk rate?", a: `Yes. Orders of 15 or more ${unit}s get a wholesale rate about 5% below the listed Elume price - shown on every product page.` },
    { q: "What is the return policy?", a: "Unused items in original packaging can be returned within 7 days of delivery, with free return shipping." },
  ];
}
