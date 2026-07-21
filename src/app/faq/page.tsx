import type { Metadata } from "next";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import InfoPage from "@/components/storefront/InfoPage";
import { faqJsonLd, type Faq } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ — ordering, delivery, GST & returns",
  description: "Answers to common questions about buying electrical goods on Elume: delivery, GST invoices, wholesale pricing, payments, returns and order tracking.",
  alternates: { canonical: "https://elumenuvo.com/faq" },
};

const FAQS: Faq[] = [
  { q: "Are the products genuine?", a: "Yes. Every product on Elume is 100% genuine, sourced through authorised channels, and carries the manufacturer's standard warranty." },
  { q: "Do you deliver across India?", a: "Yes — we deliver pan-India, usually within 3–7 working days, and delivery is free on every order." },
  { q: "Can I get a GST invoice?", a: "Yes. Enter your GSTIN at checkout and we issue a GST invoice with tax shown separately, so businesses can claim input tax credit." },
  { q: "Is there a wholesale or bulk rate?", a: "Yes. Bulk orders unlock a wholesale rate about 5% below the listed Elume price — the tier is shown on every product page." },
  { q: "What payment methods do you accept?", a: "We accept UPI, credit and debit cards, net banking and wallets through our secure Razorpay checkout. Payment is taken online when you place the order. 30-day NBFC credit for businesses is coming soon." },
  { q: "How do I track my order?", a: "Use the Track an order page with your order ID, or sign in and open My orders for live status on every purchase." },
  { q: "What is the return policy?", a: "Unused items in original packaging can be returned within 7 days of delivery, with free return shipping. See our Returns & refunds page for details." },
  { q: "Can I cancel an order?", a: "Yes — orders can be cancelled free of charge any time before dispatch. Email info@elumenuvo.com or call +91 98188 21175 with your order ID." },
  { q: "Do products carry a warranty?", a: "Yes — the manufacturer's standard warranty applies to every product. Keep your Elume invoice; it is your proof of purchase for warranty claims." },
  { q: "I can't find the product I need. Can you source it?", a: "Usually, yes. Submit the details on our Request a product page and we'll email you an Elume price, typically within 2 working days." },
];

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqJsonLd(FAQS)) }} />
      <InfoPage
        kicker="Help centre"
        title="Frequently asked questions"
        intro="Everything about ordering electrical goods on Elume — delivery, GST invoices, wholesale rates, payments and returns."
        sections={FAQS.map((f) => ({ h: f.q, body: f.a }))}
      />
    </>
  );
}
