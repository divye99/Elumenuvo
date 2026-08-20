import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";
import { COMPANY, officeLine } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contact Elume - email, phone and address",
  description:
    "How to reach Elume Nuvotech Private Limited: email, phone, support hours, registered office address, and where to go for order, return and business enquiries.",
  alternates: { canonical: "https://elumenuvo.com/contact" },
};

const link = { color: "#1D2F8A", fontWeight: 600 } as const;

export default function ContactPage() {
  return (
    <InfoPage
      kicker="Contact us"
      title="Talk to us"
      intro="We answer our own phone and email, around the clock. Email is fastest for anything involving an order number."
      updated="28 July 2026"
      sections={[
        {
          h: "Email",
          body: (
            <>
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a> - for orders, returns, GST invoices,
              bulk quotes and anything else. Include your order ID (it looks like ELM-2607-1234) and we can answer in
              one reply instead of three.
            </>
          ),
        },
        {
          h: "Phone",
          body: (
            <>
              <a href={`tel:${COMPANY.phone}`} style={link}>{COMPANY.phoneDisplay}</a> - {COMPANY.hours}. If we are on
              another call, leave a message or drop us an email and we will come straight back to you.
            </>
          ),
        },
        {
          h: "Registered office",
          body: (
            <>
              <b>{COMPANY.legalName}</b>
              <br />
              {COMPANY.registeredOffice.line1}
              <br />
              {COMPANY.registeredOffice.city}, {COMPANY.registeredOffice.state} {COMPANY.registeredOffice.pin}, {COMPANY.country}
              <br />
              CIN: {COMPANY.cin}
              {COMPANY.gstin ? <><br />GSTIN: {COMPANY.gstin}</> : null}
              <br />
              <br />
              This is also the address for <b>returns and all postal correspondence</b>. Please do not ship a return
              anywhere else, and always email us first so we can raise a pickup and track it against your order.
            </>
          ),
        },
        {
          h: "Additional office",
          body: (
            <>
              {officeLine(COMPANY.additionalOffice)}
              <br />
              <br />
              Our second working location. Returns should still go to the registered office above.
            </>
          ),
        },
        {
          h: "Order and delivery questions",
          body: (
            <>
              You can follow any order yourself at <a href="/track" style={link}>track your order</a> using the order ID
              and the email you ordered with - no account needed. Delivery timelines and charges are set out on our{" "}
              <a href="/shipping" style={link}>shipping page</a>.
            </>
          ),
        },
        {
          h: "Returns and refunds",
          body: (
            <>
              Our policy, the eligibility rules and the refund timeline are on the{" "}
              <a href="/returns" style={link}>returns and refunds page</a>. To start a return, email us with your order
              ID and we will arrange a free reverse pickup.
            </>
          ),
        },
        {
          h: "Business, credit and supply",
          body: (
            <>
              For contractor and business accounts see <a href="/business" style={link}>Elume for business</a>, for
              payment terms see <a href="/credit" style={link}>30-day credit</a>, and if you manufacture or distribute
              electrical goods and want to list with us, see <a href="/sell" style={link}>sell on Elume</a>. Can&apos;t
              find a product? <a href="/request-product" style={link}>Tell us what you need</a> and we will source it.
            </>
          ),
        },
      ]}
    />
  );
}
