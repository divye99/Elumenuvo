import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";
import { COMPANY, addressLine, officeLine } from "@/lib/company";

export const metadata: Metadata = {
  title: "About Elume - who we are",
  description:
    "Elume is a multi-brand online store for electrical goods in India, operated by Elume Nuvotech Private Limited. Who we are, how we buy and sell, and how to reach us.",
  alternates: { canonical: "https://elumenuvo.com/about" },
};

export default function AboutPage() {
  return (
    <InfoPage
      kicker="About us"
      title="Who we are"
      intro="Elume is an online store for electrical goods - wires and cables, switchgear, fans, lighting and modular switches - serving homes, electricians, contractors and businesses across India."
      updated="28 July 2026"
      sections={[
        {
          h: "The company behind the store",
          body: (
            <>
              This store is owned and operated by <b>{COMPANY.legalName}</b>, a company incorporated in India under
              Corporate Identity Number <b>{COMPANY.cin}</b>.
              {COMPANY.gstin ? <> Our GSTIN is <b>{COMPANY.gstin}</b>.</> : null}
              <br />
              <br />
              <b>Registered office:</b> {addressLine()} - this is also where returns are sent.
              <br />
              <b>Additional office:</b> {officeLine(COMPANY.additionalOffice)}
              <br />
              <br />
              Every order is invoiced by {COMPANY.legalName} with GST, so what you buy here is backed by a registered
              Indian company with a verifiable address, not an anonymous storefront.
            </>
          ),
        },
        {
          h: "What we sell, and where it comes from",
          body: (
            <>
              We are a multi-brand retailer. We list genuine, branded products from manufacturers including Havells,
              Polycab, Finolex, Crompton, Schneider, Legrand, ABB, Orient, Atomberg and Syska, alongside our own
              Elume-branded house wires. We are not the manufacturer of third-party brands and we do not claim to be
              their authorised distributor unless stated on the product page. Goods are sourced through the trade and
              sold new, in original packaging, with the manufacturer&apos;s warranty intact.
            </>
          ),
        },
        {
          h: "How our pricing works",
          body: (
            <>
              We publish one transparent price list. Prices are shown excluding GST, with the GST amount and the
              inclusive total displayed before you pay, and a wholesale rate applies automatically on 15 units or more.
              We track brand and marketplace pricing daily and keep our price at or below it wherever we can. There are
              no hidden charges: delivery is free on orders of ₹4,000 and above, with a small flat fee below that, and every charge is itemised at checkout before you pay.
            </>
          ),
        },
        {
          h: "How we handle your order",
          body: (
            <>
              You order online and pay securely through Razorpay (UPI, cards, net banking and wallets). We never see or
              store your card details. We then confirm the order, ship it pan-India, and email you at every stage with a
              tracking link. If something is unavailable, we contact you and offer a replacement or a refund rather than
              leaving the order open.
            </>
          ),
        },
        {
          h: "Talking to a human",
          body: (
            <>
              We are a small team and we answer our own email and phone. Reach us at{" "}
              <a href={`mailto:${COMPANY.email}`} style={{ color: "#4E5BDC", fontWeight: 600 }}>{COMPANY.email}</a> or{" "}
              <a href={`tel:${COMPANY.phone}`} style={{ color: "#4E5BDC", fontWeight: 600 }}>{COMPANY.phoneDisplay}</a>,{" "}
              {COMPANY.hours}. Full contact details, including our postal address, are on our{" "}
              <a href="/contact" style={{ color: "#4E5BDC", fontWeight: 600 }}>contact page</a>.
            </>
          ),
        },
      ]}
    />
  );
}
