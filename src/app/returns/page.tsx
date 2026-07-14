import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";

export const metadata: Metadata = {
  title: "Returns & refunds policy",
  description: "Elume's 7-day return policy for electrical goods: what's eligible, how to start a return, and when refunds are issued.",
  alternates: { canonical: "https://elumenuvo.com/returns" },
};

export default function ReturnsPage() {
  return (
    <InfoPage
      kicker="Help centre"
      title="Returns & refunds"
      intro="We keep returns simple: 7 days, free return shipping, full refund once the item reaches us in original condition."
      updated="9 July 2026"
      sections={[
        {
          h: "The 7-day window",
          body: "You can return any eligible item within 7 days of delivery. The item must be unused, uninstalled and in its original packaging with all accessories, manuals and warranty cards intact.",
        },
        {
          h: "What's eligible",
          body: (
            <>
              Most catalogue items are returnable. A few exceptions apply: wires and cables cut to a custom length,
              products that have been installed or energised, and items with tampered serial numbers or missing
              packaging. Damaged-on-arrival or wrongly shipped items are <b>always</b> returnable — report them within
              48 hours of delivery with photos and we&apos;ll arrange a replacement or refund immediately.
            </>
          ),
        },
        {
          h: "How to start a return",
          body: (
            <>
              Email <a href="mailto:info@elumenuvo.com" style={{ color: "#4E5BDC", fontWeight: 600 }}>info@elumenuvo.com</a> or
              call +91 98188 21175 with your order ID and the item you want to return. We&apos;ll confirm eligibility and
              arrange a free reverse pickup from your address — you don&apos;t pay for return shipping.
            </>
          ),
        },
        {
          h: "Refund timelines",
          body: "Once the item passes our quality check (typically 2–3 working days after pickup), the refund is issued back to the original payment method through Razorpay. Banks and UPI apps usually take a further 3–7 working days to credit the amount.",
        },
        {
          h: "Warranty claims",
          body: "Manufacturing defects that surface after the return window are covered by the manufacturer's standard warranty. Keep your Elume GST invoice — it is your proof of purchase. We're happy to help you route a warranty claim to the brand's service network.",
        },
      ]}
    />
  );
}
