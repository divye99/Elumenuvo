import { faqJsonLd, type Faq } from "@/lib/seo";
import { jsonLd as toJsonLd } from "@/lib/jsonld";

/**
 * Visible FAQ section + matching FAQPage JSON-LD. The on-page Q&A must mirror
 * the schema for it to be valid, so this renders both from one source.
 */
export default function ProductFaq({ faqs, title = "Frequently asked questions" }: { faqs: Faq[]; title?: string }) {
  if (!faqs.length) return null;
  return (
    <section style={{ maxWidth: 1120, margin: "0 auto", padding: "0 30px" }} aria-label="Frequently asked questions">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqJsonLd(faqs)) }} />
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 24px" }}>
        <h2 style={{ fontFamily: "var(--space-grotesk)", fontSize: 20, fontWeight: 600, margin: "0 0 14px" }}>{title}</h2>
        <div>
          {faqs.map((f, i) => (
            <details key={i} style={{ borderTop: i ? "1px solid #F0F2F6" : undefined, padding: "12px 0" }}>
              <summary style={{ fontSize: 14.5, fontWeight: 600, color: "#19202E", cursor: "pointer", listStyle: "none" }}>{f.q}</summary>
              <p style={{ fontSize: 13.5, color: "#56627A", lineHeight: 1.6, margin: "8px 0 0" }}>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
