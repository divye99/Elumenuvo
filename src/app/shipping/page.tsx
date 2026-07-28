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
      intro="Free delivery anywhere in India, in 3 to 7 days, with tracking on every order. No shipping charge is added at checkout, whatever you buy."
      updated="28 July 2026"
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
              <b>3 to 7 days</b> from the day we confirm your order, for most items and most destinations. Metro
              addresses are usually at the faster end of that range and remote PIN codes at the slower end. Large or
              heavy consignments (bulk cable drums, panel boards) can take a little longer, and we will tell you the
              expected date when we confirm the order rather than leaving you guessing.
            </>
          ),
        },
        {
          h: "Delivery is free",
          body: (
            <>
              <b>We do not charge for delivery.</b> There is no minimum order value, no surcharge for remote PIN codes,
              and no fee added after you have ordered. The amount you see at checkout is the amount you pay: product
              price plus GST, nothing else. Prices on product pages are shown excluding GST, and GST is added at
              checkout.
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
              Open the parcel and check the goods on arrival where you can, especially glass fittings, fans and
              anything that looks knocked about in transit. If something arrives damaged, is missing from the box, or is
              not what you ordered, email{" "}
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a> within <b>48 hours of delivery</b>{" "}
              with your order ID and photos of the item and the outer packaging. Photos of the packaging matter: they
              are what let us claim against the courier, and they mean we never have to argue with you about it.
              <br />
              <br />
              Damaged-on-arrival, short-shipped and wrongly shipped items are <b>always</b> covered, with no
              restocking fee and no return shipping to pay. You choose the outcome: a replacement sent out at our cost,
              or a full refund to your original payment method. Refunds are raised as soon as we have your photos, and
              typically reach you in 5 to 7 working days depending on your bank. If an item was energised or installed
              before the damage was noticed we will still look at it, but please tell us before installing anything you
              have doubts about. Full detail is in the{" "}
              <a href="/returns" style={link}>returns and refunds policy</a>.
            </>
          ),
        },
        {
          h: "If an item turns out to be unavailable",
          body: (
            <>
              Occasionally a manufacturer discontinues a line, or a batch sells out, after you have ordered. We will not
              leave your order sitting open and we will never quietly substitute something and hope you do not notice.
              Here is exactly what happens.
              <br />
              <br />
              We contact you with the <b>best available alternative</b>: the closest match we can find on
              specification first (rating, wattage, size, material and standard), then on brand, then on price. For
              example, a discontinued 10 W rechargeable torch is offered against the current 10 W model with equal or
              better runtime, not against whatever happens to be in stock.
              <br />
              <br />
              You then choose one of three things, and nothing moves until you do:
              <br />
              <br />
              <b>1. Take the alternative at no extra cost.</b> If the replacement is priced higher than what you paid,
              we absorb the difference and your bill does not change.
              <br />
              <b>2. Take the alternative on a fresh order at its own price.</b> If it is cheaper, we raise a new order
              at the correct price and refund you the difference.
              <br />
              <b>3. Take a full refund</b> of that item to your original payment method, plus a 10% discount code for
              your next order, because the wasted trip was our fault and not yours.
              <br />
              <br />
              If we cannot reach you, we refund rather than substitute. Your money does not sit with us while we wait.
            </>
          ),
        },
      ]}
    />
  );
}
