import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import LeadForm from "@/components/storefront/LeadForm";
import { submitPartnerLead } from "@/lib/actions";
import { GROTESK } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Can't find what you need? — request a product",
  description:
    "Looking for an electrical product we don't stock yet? Tell us what you need — brand, spec and quantity — and Elume will source it and email you a price.",
  alternates: { canonical: "https://elumenuvo.com/request-product" },
  openGraph: {
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }],
    title: "Request a product on Elume",
    description: "Tell us what you need and we'll source it at an Elume price.",
    url: "https://elumenuvo.com/request-product",
    type: "website",
  },
};

const STEPS = [
  { n: "1", title: "Tell us what you need", body: "Product, brand preference, spec and rough quantity — whatever you have." },
  { n: "2", title: "We source it", body: "Our team checks with brand partners and authorised channels for stock and pricing." },
  { n: "3", title: "You get a price", body: "We email you an Elume price — usually within 2 working days. No obligation to buy." },
];

export default function RequestProductPage() {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 72px" }}>
        <div className="pd-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1.1fr", gap: 40, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 10 }}>
              Product sourcing
            </div>
            <h1 style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-0.9px", lineHeight: 1.15, margin: 0 }}>
              Can&apos;t find what you need?
            </h1>
            <p style={{ fontSize: 15, color: "#56627A", lineHeight: 1.6, margin: "14px 0 26px" }}>
              Our catalogue grows every week, but if the exact product you need isn&apos;t listed yet, we&apos;ll
              source it for you — same transparent pricing, same GST invoice, same pan-India delivery.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {STEPS.map((s) => (
                <div key={s.n} style={{ display: "flex", gap: 14, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
                  <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: "#EEF0FE", color: "#4E5BDC", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.n}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{s.title}</div>
                    <p style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.55, margin: "3px 0 0" }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 24px 26px" }}>
            <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, marginBottom: 14 }}>What are you looking for?</div>
            <LeadForm
              action={submitPartnerLead.bind(null, "product-request")}
              submitLabel="Request this product"
              footnote="We'll email you a price if we can source it. No spam, no obligation."
              fields={[
                { name: "product", label: "Product", placeholder: "e.g. 4-pole 63A MCB isolator", required: true },
                { name: "brand", label: "Preferred brand", placeholder: "Any / Havells / Polycab…", half: true },
                { name: "quantity", label: "Quantity needed", placeholder: "e.g. 25 units", half: true },
                { name: "spec", label: "Spec / details", placeholder: "Rating, size, colour, model number — anything that pins it down", type: "textarea" },
                { name: "name", label: "Your name", required: true, half: true },
                { name: "phone", label: "Phone", placeholder: "+91…", type: "tel", half: true },
                { name: "email", label: "Email", placeholder: "you@company.com", type: "email", required: true },
              ]}
            />
          </div>
        </div>
      </main>
    </StoreChrome>
  );
}
