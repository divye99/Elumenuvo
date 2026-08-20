import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import LeadForm from "@/components/storefront/LeadForm";
import { submitPartnerLead } from "@/lib/actions";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import { GROTESK } from "@/lib/fonts";

/**
 * /bulk-enquiry: the header's B2B entry point (owner, Aug 2026 - replaced
 * "For business" in the navbar; the business pitch page stays in the footer).
 * One form: contact person, company, mobile, email, requirement. Submission
 * emails info@elumenuvo.com with the customer in CC (see submitPartnerLead
 * kind "bulk-enquiry" + sendBulkEnquiryEmail) and promises a reply in 24h.
 */

export const metadata: Metadata = {
  title: "Bulk Enquiry - Wholesale & Project Quotes for Electrical Goods",
  description:
    "Buying electrical goods in bulk? Send Elume your requirement - wires and cables, switchgear, lighting, fans, modular - and get a consolidated multi-brand quote with GST invoice and pan-India delivery within 24 hours.",
  alternates: { canonical: "https://elumenuvo.com/bulk-enquiry" },
  openGraph: {
    siteName: "Elume",
    title: "Bulk Enquiry - Wholesale & Project Quotes | Elume",
    description: "One requirement, one consolidated quote across 24+ electrical brands. Response within 24 hours.",
    url: "https://elumenuvo.com/bulk-enquiry",
    type: "website",
  },
};

const BREADCRUMB_LD = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://elumenuvo.com" },
    { "@type": "ListItem", position: 2, name: "Bulk enquiry" },
  ],
};

const BENEFITS: { icon: string; title: string; body: string }[] = [
  { icon: "🏷️", title: "Real wholesale pricing", body: "A wholesale rate applies automatically from 15 units on the site; on project volumes we quote sharper still, line by line." },
  { icon: "🧮", title: "One quote, every brand", body: "Wires, switchgear, lighting, fans and modular from 24+ brands and 9,000+ listings, consolidated into a single priced quote." },
  { icon: "📋", title: "Send a BOQ as-is", body: "Paste or attach your BOQ the way it is written. Our team (and our Smart BOM engine) matches every line to exact catalogue items and flags anything we cannot supply, honestly." },
  { icon: "🧾", title: "GST invoice, input credit", body: "Every order is invoiced by Elume Nuvotech Private Limited with the tax split shown, so your business claims input tax credit without follow-ups." },
  { icon: "🚚", title: "Pan-India project delivery", body: "Doorstep delivery across India, typically 3-7 working days, including heavy freight like wire coils and distribution boards." },
  { icon: "🤝", title: "A human on your account", body: "No ticket queues. A named person picks up your enquiry, and replies land from info@elumenuvo.com with you already in the thread." },
];

export default function BulkEnquiryPage() {
  return (
    <StoreChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(BREADCRUMB_LD) }} />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 28px 72px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 10 }}>
          Bulk enquiry
        </div>
        <h1 style={{ fontFamily: GROTESK, fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 600, letterSpacing: "-0.8px", margin: 0, maxWidth: 720 }}>
          Buying in bulk? Tell us what you need, get a quote back within 24 hours.
        </h1>
        <p style={{ fontSize: 14.5, color: "#56627A", lineHeight: 1.65, margin: "14px 0 0", maxWidth: 720 }}>
          For contractors, builders, facility teams, purchase departments and resellers: send your requirement once
          and our team returns one consolidated, GST-ready quote across every brand we carry. We respond to every
          enquiry <b style={{ color: "#19202E" }}>within 24 hours</b>.
        </p>

        <div className="bulk-grid" style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 28, marginTop: 32, alignItems: "start" }}>
          {/* ── Benefits ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="bulk-benefits">
            {BENEFITS.map((b) => (
              <div key={b.title} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ fontSize: 20 }}>{b.icon}</div>
                <div style={{ fontFamily: GROTESK, fontSize: 14.5, fontWeight: 700, margin: "8px 0 4px" }}>{b.title}</div>
                <div style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.6 }}>{b.body}</div>
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1", background: "#161D2B", color: "#C6CDE2", borderRadius: 14, padding: "14px 18px", fontSize: 12.5, lineHeight: 1.6 }}>
              Prefer email or phone? Write to <a href="mailto:info@elumenuvo.com" style={{ color: "#9DB0FF", fontWeight: 700 }}>info@elumenuvo.com</a> or
              call <a href="tel:+919818821175" style={{ color: "#9DB0FF", fontWeight: 700 }}>+91 98188 21175</a>. 30-day NBFC credit for
              business buyers is coming soon; ask about the waitlist in your enquiry.
            </div>
          </div>

          {/* ── The form ── */}
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 24px" }}>
            <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Send your requirement</div>
            <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>
              You get an email copy instantly, and our reply lands on the same thread within 24 hours.
            </p>
            <LeadForm
              action={submitPartnerLead.bind(null, "bulk-enquiry")}
              fields={[
                { name: "name", label: "Contact person", required: true, half: true },
                { name: "company", label: "Company name", half: true },
                { name: "phone", label: "Mobile number", type: "tel", required: true, half: true },
                { name: "email", label: "Email ID", type: "email", required: true, half: true },
                { name: "message", label: "Your requirement", type: "textarea", required: true, placeholder: "e.g. 40 coils Polycab 2.5 sq mm FR (red/black/green), 24 Havells 20A MCBs, 60 modular switches... quantities, brands and delivery pincode help us quote faster. Paste a BOQ as-is if you have one." },
              ]}
              submitLabel="Submit enquiry"
              footnote="Submitting emails our team at info@elumenuvo.com with you in CC, so you always hold a copy. Response within 24 hours."
            />
          </div>
        </div>
      </main>
      <style>{`
        @media (max-width: 900px) {
          .bulk-grid { grid-template-columns: 1fr !important; }
          .bulk-benefits { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .bulk-benefits { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </StoreChrome>
  );
}
