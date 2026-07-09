import type { Metadata } from "next";
import InfoPage from "@/components/storefront/InfoPage";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Elume Nuvotech Private Limited collects, uses and protects your personal data.",
  alternates: { canonical: "https://elumenuvo.com/privacy" },
};

export default function PrivacyPage() {
  return (
    <InfoPage
      kicker="Legal"
      title="Privacy policy"
      intro="This policy explains what personal data Elume Nuvotech Private Limited (“Elume”, “we”) collects when you use elumenuvo.com, why we collect it, and the choices you have."
      updated="9 July 2026"
      sections={[
        {
          h: "What we collect",
          body: (
            <>
              <b>Order details</b> — name, delivery address, phone number, email and GSTIN (if provided) when you place
              an order. <b>Account details</b> — email and profile information when you create an account.{" "}
              <b>Form submissions</b> — details you send through our waitlist, seller and product-request forms.{" "}
              <b>Usage data</b> — standard server logs (IP address, pages visited) used to keep the site secure and fast.
            </>
          ),
        },
        {
          h: "How we use it",
          body: "To fulfil and deliver your orders, issue GST invoices, provide order tracking and customer support, respond to your enquiries, and improve the store. We do not sell your personal data, and we don't send marketing email unless you've opted in (for example, by joining a waitlist).",
        },
        {
          h: "Who we share it with",
          body: "Trusted service providers that make the store work: our database and authentication provider (Supabase), payment processors for online payments, and logistics partners who need your name, address and phone number to deliver your order. Each receives only what it needs.",
        },
        {
          h: "Data retention & security",
          body: "Order and invoice records are retained as required by Indian tax law. Account data is kept while your account is active. Data is stored encrypted at rest and transmitted over HTTPS; access is limited to authorised personnel.",
        },
        {
          h: "Your rights",
          body: (
            <>
              You can ask us to access, correct or delete your personal data at any time by writing to{" "}
              <a href="mailto:info@elumenuvo.com" style={{ color: "#4E5BDC", fontWeight: 600 }}>info@elumenuvo.com</a>.
              We&apos;ll respond within 30 days. Deleting data that we must keep for tax or legal compliance (e.g. GST
              invoices) may not be possible until the statutory period lapses.
            </>
          ),
        },
        {
          h: "Cookies",
          body: "We use only essential cookies: keeping you signed in and remembering your cart. We do not run third-party advertising trackers.",
        },
        {
          h: "Changes to this policy",
          body: "If we make material changes, we'll update this page and revise the date above. Continued use of the site after changes means you accept the updated policy.",
        },
      ]}
    />
  );
}
