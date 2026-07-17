import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import LeadForm from "@/components/storefront/LeadForm";
import { submitPartnerLead } from "@/lib/actions";
import { GROTESK } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Sell on Elume — list your electrical brand",
  description:
    "Manufacture or distribute electrical goods? List your brand on Elume and reach electricians, contractors and businesses buying FMEG across India.",
  alternates: { canonical: "https://elumenuvo.com/sell" },
  openGraph: {
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }],
    title: "Sell on Elume",
    description: "List your electrical brand on India's transparent FMEG store.",
    url: "https://elumenuvo.com/sell",
    type: "website",
  },
};

const PERKS = [
  { icon: "🛍️", title: "Pan-India storefront", body: "Your catalogue in front of electricians, contractors and businesses across India — no dealer network needed." },
  { icon: "📊", title: "Transparent pricing", body: "One price list next to every major brand. Great products win on merit, not on distribution muscle." },
  { icon: "🚚", title: "We handle the orders", body: "Checkout, GST invoicing, payment collection and delivery coordination run on Elume." },
  { icon: "🤝", title: "Simple commercials", body: "No listing fees to start. We agree a straightforward margin and you keep control of your MRP." },
];

export default function SellPage() {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 72px" }}>
        <div className="pd-grid" style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 40, alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 10 }}>
              For brands &amp; manufacturers
            </div>
            <h1 style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-0.9px", lineHeight: 1.15, margin: 0 }}>
              Sell on Elume
            </h1>
            <p style={{ fontSize: 15, color: "#56627A", lineHeight: 1.6, margin: "14px 0 26px" }}>
              We stock India&apos;s leading electrical brands — wires, switchgear, modular, fans, lighting and
              DBs — and we&apos;re always adding more. Tell us about your brand and our partnerships team
              will get back within 2 working days.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {PERKS.map((p) => (
                <div key={p.title} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{p.icon}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{p.title}</div>
                  <p style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.55, margin: "5px 0 0" }}>{p.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 24px 26px" }}>
            <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, marginBottom: 14 }}>Tell us about your brand</div>
            <LeadForm
              action={submitPartnerLead.bind(null, "seller")}
              submitLabel="Apply to sell on Elume"
              footnote="We'll only use these details to evaluate the partnership. No spam."
              fields={[
                { name: "brand", label: "Brand name", placeholder: "e.g. Volta Wires", required: true, half: true },
                { name: "company", label: "Company / legal entity", placeholder: "Pvt Ltd / LLP / proprietorship", half: true },
                { name: "name", label: "Contact person", placeholder: "Your name", required: true, half: true },
                { name: "phone", label: "Phone", placeholder: "+91…", type: "tel", half: true },
                { name: "email", label: "Work email", placeholder: "you@brand.com", type: "email", required: true },
                { name: "categories", label: "Product categories", placeholder: "Wires, MCBs, fans…", half: true },
                { name: "website", label: "Website / catalogue link", placeholder: "https://…", half: true },
                { name: "message", label: "Anything else?", placeholder: "Production capacity, certifications (ISI/BIS), current distribution…", type: "textarea" },
              ]}
            />
          </div>
        </div>
      </main>
    </StoreChrome>
  );
}
