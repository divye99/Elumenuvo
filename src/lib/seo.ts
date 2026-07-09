/**
 * Shared structured-data (schema.org / JSON-LD) building blocks — reused across
 * the site so Organization, Offer policies and FAQ markup stay consistent and
 * standardised for search + AI answer engines.
 */
export const SITE = "https://elumenuvo.com";

/** Organization / publisher identity (add @context where embedded). */
export const ORG = {
  "@type": "Organization",
  name: "Elume Nuvotech Private Limited",
  legalName: "Elume Nuvotech Private Limited",
  alternateName: "Elume",
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
  sameAs: [] as string[], // add social/profile URLs as they go live
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

export const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingRate: { "@type": "MonetaryAmount", value: 0, currency: "INR" },
  shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
    transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 7, unitCode: "DAY" },
  },
};

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
    { q: "Do you deliver across India?", a: "Yes — we deliver pan-India, usually within 3–7 working days, and delivery is free." },
    { q: "Can I get a GST invoice?", a: "Yes. Enter your GSTIN at checkout and we issue a GST invoice with tax shown separately, so businesses can claim input tax credit." },
    { q: "Is there a wholesale or bulk rate?", a: `Yes. Orders of 15 or more ${unit}s get a wholesale rate about 5% below the listed Elume price — shown on every product page.` },
    { q: "What is the return policy?", a: "Unused items in original packaging can be returned within 7 days of delivery, with free return shipping." },
  ];
}
