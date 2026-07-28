import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";
import { COMPANY, addressLine } from "@/lib/company";

export const metadata: Metadata = {
  title: "Contact Elume — email, phone and address",
  description:
    "How to reach Elume Nuvotech Private Limited: email, phone, support hours, registered office address, and where to go for order, return and business enquiries.",
  alternates: { canonical: "https://elumenuvo.com/contact" },
};

const link = { color: "#4E5BDC", fontWeight: 600 } as const;

export default function ContactPage() {
  const addr = addressLine();
  return (
    <InfoPage
      kicker="Contact us"
      title="Talk to us"
      intro="Real people, same-day replies on working days. Email is fastest for anything involving an order number."
      updated="27 July 2026"
      sections={[
        {
          h: "Email",
          body: (
            <>
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a> — for orders, returns, GST invoices,
              bulk quotes and anything else. Include your order ID (it looks like ELM-2607-1234) and we can answer in
              one reply instead of three.
            </>
          ),
        },
        {
          h: "Phone",
          body: (
            <>
              <a href={`tel:${COMPANY.phone}`} style={link}>{COMPANY.phoneDisplay}</a> — {COMPANY.hours}. Outside those
              hours, email us and we will come back the next working day.
            </>
          ),
        },
        {
          h: "Registered office",
          body: addr ? (
            <>
              {COMPANY.legalName}
              <br />
              {addr}
              {COMPANY.cin ? <><br />CIN: {COMPANY.cin}</> : null}
              {COMPANY.gstin ? <><br />GSTIN: {COMPANY.gstin}</> : null}
            </>
          ) : (
            <>
              {COMPANY.legalName}, {COMPANY.country}. Our full postal address is available on request by email — write to{" "}
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a>.
            </>
          ),
        },
        {
          h: "Order and delivery questions",
          body: (
            <>
              You can follow any order yourself at <a href="/track" style={link}>track your order</a> using the order ID
              and the email you ordered with — no account needed. Delivery timelines and charges are set out on our{" "}
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
