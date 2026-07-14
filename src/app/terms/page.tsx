import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "Terms of use and sale for elumenuvo.com, operated by Elume Nuvotech Private Limited.",
  alternates: { canonical: "https://elumenuvo.com/terms" },
};

export default function TermsPage() {
  return (
    <InfoPage
      kicker="Legal"
      title="Terms & conditions"
      intro="These terms govern your use of elumenuvo.com and every purchase made on it. The site is operated by Elume Nuvotech Private Limited (“Elume”, “we”). By using the site you agree to these terms."
      updated="9 July 2026"
      sections={[
        {
          h: "Products & pricing",
          body: "All prices are in Indian Rupees and include GST unless stated otherwise. MRP references are the manufacturer's printed MRP. Wholesale tiers apply automatically at the quantities shown on each product page. We work hard to keep prices and stock accurate, but if a listing contains an obvious error we may cancel the affected order with a full refund.",
        },
        {
          h: "Orders & acceptance",
          body: "Your order is an offer to buy; it's accepted when we confirm dispatch. We may decline or cancel orders for suspected fraud, pricing errors or stock unavailability — in each case anything you've paid is refunded in full.",
        },
        {
          h: "Delivery",
          body: "We deliver pan-India, typically within 3–7 working days of dispatch. Delivery timelines shown on the site are estimates, not guarantees; remote pin codes can take longer. Risk in the goods passes to you on delivery.",
        },
        {
          h: "Payments",
          body: "Orders are paid online at checkout through Razorpay, an RBI-regulated payment gateway, using UPI, cards, net banking or wallets. Payment is taken in full when the order is placed. We never see or store your card details; they are handled entirely by the gateway.",
        },
        {
          h: "Returns & warranty",
          body: (
            <>
              Returns are governed by our{" "}
              <a href="/returns" style={{ color: "#4E5BDC", fontWeight: 600 }}>Returns &amp; refunds policy</a> (7-day
              window, free return shipping). Products carry the manufacturer&apos;s standard warranty; your Elume GST
              invoice is your proof of purchase.
            </>
          ),
        },
        {
          h: "Acceptable use",
          body: "Don't misuse the site: no scraping at abusive rates, no attempts to breach security, no fraudulent orders or reviews. Business accounts must provide a valid GSTIN for GST-invoiced purchases.",
        },
        {
          h: "Liability",
          body: "To the extent permitted by law, our liability for any claim arising from an order is limited to the amount you paid for that order. Nothing in these terms limits liability that cannot be limited under Indian law, including under the Consumer Protection Act, 2019.",
        },
        {
          h: "Governing law",
          body: "These terms are governed by the laws of India. Courts at New Delhi have exclusive jurisdiction, subject to any non-waivable consumer-forum rights you hold.",
        },
      ]}
    />
  );
}
