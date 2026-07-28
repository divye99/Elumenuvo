import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = {
  title: "Shipping & delivery",
  description:
    "How Elume ships electrical goods across India: delivery timelines, charges, coverage, tracking, and what to do if a parcel arrives damaged.",
  alternates: { canonical: "https://elumenuvo.com/shipping" },
};

const link = { color: "#4E5BDC", fontWeight: 600 } as const;

export default function ShippingPage() {
  return (
    <InfoPage
      kicker="Help centre"
      title="Shipping & delivery"
      intro="We ship pan-India. Most orders reach you in 3 to 7 working days, and you can follow every one of them with a tracking link."
      updated="27 July 2026"
      sections={[
        {
          h: "Where we deliver",
          body: (
            <>
              Anywhere in India that our courier partners serve, including tier-2 and tier-3 towns. We do not ship
              outside India. If your PIN code is not serviceable we will tell you before taking payment, or refund you
              in full if it comes to light afterwards.
            </>
          ),
        },
        {
          h: "How long it takes",
          body: (
            <>
              <b>3 to 7 working days</b> from the day we confirm your order, for most items and most destinations. Metro
              addresses are usually at the faster end of that range and remote PIN codes at the slower end. Working days
              exclude Sundays and public holidays. Large or heavy consignments (bulk cable drums, panel boards) can take
              longer, and we will tell you the expected date when we confirm the order.
            </>
          ),
        },
        {
          h: "Delivery charges",
          body: (
            <>
              Any delivery charge that applies to your order is shown on the order summary at checkout, before you pay.
              We do not add shipping fees after you have placed an order. Prices on product pages are shown excluding
              GST; GST is added at checkout.
            </>
          ),
        },
        {
          h: "Tracking your order",
          body: (
            <>
              Every status change (confirmed, packed, shipped, out for delivery, delivered) triggers an email with the
              current status and, once dispatched, the courier name and tracking number. You can also check any time at{" "}
              <a href="/track" style={link}>track your order</a> using your order ID and the email you ordered with.
              No account is needed.
            </>
          ),
        },
        {
          h: "Part shipments",
          body: (
            <>
              An order with several items may ship in more than one parcel, for example when items come from different
              warehouses. You are not charged twice for this. Each shipment gets its own tracking, and the order page
              shows you what has already shipped and what is still to come.
            </>
          ),
        },
        {
          h: "Damaged, missing or wrong items",
          body: (
            <>
              Check the parcel at delivery where you can. If something arrives damaged, is missing, or is not what you
              ordered, email{" "}
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a> within 48 hours of delivery with your
              order ID and photos. Damaged-on-arrival and wrongly shipped items are always covered: we arrange a
              replacement or a full refund, and you do not pay return shipping. See the{" "}
              <a href="/returns" style={link}>returns and refunds policy</a> for the full detail.
            </>
          ),
        },
        {
          h: "If an item turns out to be unavailable",
          body: (
            <>
              Occasionally a manufacturer discontinues a product after you have ordered it. We will contact you and
              offer a comparable replacement or a full refund to your original payment method. We do not leave orders
              open indefinitely, and we do not substitute anything without telling you first.
            </>
          ),
        },
      ]}
    />
  );
}
