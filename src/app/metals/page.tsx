import type { Metadata } from "next";
import Link from "next/link";
import { fetchProducts } from "@/lib/products";
import { isMetalCategory, lotKg, METALS_TAXONOMY, METAL_ICONS } from "@/lib/metals";
import { gstRateFor, baseExGst } from "@/lib/pricing";
import { fmt } from "@/lib/format";
import { GROTESK } from "@/lib/fonts";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import MetalsMarketCharts from "@/components/metals/MetalsMarketCharts";
import LeadForm from "@/components/storefront/LeadForm";
import { submitPartnerLead } from "@/lib/actions";

/** The questions copper buyers actually type into Google - shown on the page
 *  AND emitted as FAQPage JSON-LD so the hub can win those queries. */
const FAQS: [string, string][] = [
  [
    "What is today's copper rate on Elume?",
    "The live ex-GST ₹/kg rate for CCR rod and CC rod is published at the top of this page and on each product page, updated up to three times a day (around 9 am, 11 am and 2 pm IST) against MCX and LME copper.",
  ],
  [
    "How is the copper rate decided?",
    "We track MCX copper futures and LME copper through the trading day and set our selling rate against them. The rate you see is the rate you pay - no phone-only quotes, and every product page charts our rate history next to the exchange charts.",
  ],
  [
    "What lot sizes do CCR rod and CC rod come in?",
    "Continuous cast copper rod is sold in 3 MT (3,000 kg) and 4 MT (4,000 kg) lots. Need larger volumes or a different put-up? Raise an enquiry and our sourcing desk will quote you directly.",
  ],
  [
    "How does payment work for a copper booking?",
    "You book online with a 5% token via Razorpay, which locks that moment's rate. The balance is paid by RTGS within 2 working days, and the material dispatches with a full GST tax invoice once the balance is confirmed.",
  ],
  [
    "Who can buy copper on Elume?",
    "Copper bookings are for GSTIN-verified business buyers - a free business account takes two minutes to set up. Aluminium, zinc, lead, nickel and steel are available through the same GSTIN-verified enquiry desk.",
  ],
];

/**
 * Metals hub: the mission page for the Metals family. Copper sells online at
 * a transparent daily rate (updated 2-3x/day against MCX/LME); every other
 * metal is enquiry-first. Same ISR posture as the rest of the store.
 */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Metals at transparent daily rates - copper, aluminium, steel & more",
  description:
    "Buy copper (Super D, CCR rod, CC rod) at a transparent daily rate tracked against MCX and LME, or enquire for aluminium, zinc, lead, nickel and steel. GST invoice on every order.",
  alternates: { canonical: "https://elumenuvo.com/metals" },
};

const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16 };

export default async function MetalsHub() {
  const all = await fetchProducts();
  const copper = all.filter((p) => isMetalCategory(p.cat));
  const groups = ["Non-Ferrous", "Ferrous"] as const;

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const listLd = copper.length
    ? {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Copper at today's rate",
        itemListElement: copper.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `https://elumenuvo.com/catalogue/${p.id}`, name: p.name })),
      }
    : null;

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 30px 60px", display: "flex", flexDirection: "column", gap: 34 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faqLd) }} />
      {listLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(listLd) }} />}
      {/* ── Hero ── */}
      <section style={{ background: "linear-gradient(120deg,#19202E,#232B47)", borderRadius: 20, padding: "42px 40px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "#9DB0FF" }}>Elume Metals</span>
          <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.8px", color: "#19202E", background: "#F5C64F", borderRadius: 7, padding: "3px 9px" }}>BETA</span>
        </div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-1px", margin: "10px 0 12px", maxWidth: 640, lineHeight: 1.15 }}>
          Metals, priced the way the market prices them
        </h1>
        <p style={{ fontSize: 14.5, color: "#C6CDE2", maxWidth: 640, lineHeight: 1.6, margin: 0 }}>
          Our copper rate is updated up to three times a day against MCX and LME, published openly, and every order
          carries a GST invoice. No haggling, no phone-only quotes - the rate you see is the rate you pay.
        </p>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 22, fontSize: 12.5, color: "#C6CDE2" }}>
          <span>📈 Rates updated ~9 am · 11 am · 2 pm IST</span>
          <span>🧾 GST invoice on every order</span>
          <span>🏦 Book online · balance by RTGS</span>
        </div>
      </section>

      {/* ── Beta disclaimer ── */}
      <section style={{ background: "#FFF8E7", border: "1px solid #F0DFAE", borderRadius: 14, padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span style={{ fontSize: 16, lineHeight: "22px" }}>🚧</span>
        <p style={{ fontSize: 13, color: "#6B5A20", lineHeight: 1.6, margin: 0 }}>
          <strong>Elume Metals is in beta and under active development.</strong> Rates, charts and market data on
          this page are indicative: they can lag the exchange and may not always be accurate or complete. Please
          confirm the applicable rate with us before transacting. Feeds, coverage and tooling are improving week
          by week.
        </p>
      </section>

      {/* ── Live copper ── */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Buy online</div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", margin: "4px 0 0", color: "#19202E" }}>
              Copper · today&apos;s rate
            </h2>
          </div>
          <span style={{ fontSize: 12, color: "#8A93A6" }}>Ex-GST ₹/kg headline · 18% GST added at checkout</span>
        </div>
        {copper.length === 0 ? (
          <div style={{ ...card, padding: "26px 28px", marginTop: 12 }}>
            <div style={{ fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: "#19202E" }}>Copper trading opens shortly</div>
            <p style={{ fontSize: 13.5, color: "#56627A", margin: "6px 0 12px", lineHeight: 1.55, maxWidth: 560 }}>
              Super D, CCR rod and CC rod go live here at a transparent daily rate. Until then, tell us what you need
              and we&apos;ll quote you directly.
            </p>
            <Link href="/metals/enquiry?metal=Copper" style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 10 }}>
              Enquire about copper →
            </Link>
          </div>
        ) : (
          <div className="metals-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 12 }}>
            {copper.map((p) => {
              const kg = lotKg(p.attrs);
              const rate = baseExGst(p.price, p.cat, p.gstRate) / kg;
              return (
                <Link key={p.id} href={`/catalogue/${p.id}`} style={{ ...card, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: "#19202E" }}>{p.name}</span>
                    {p.attrs?.Lot && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FD", borderRadius: 7, padding: "2px 8px" }}>{p.attrs.Lot}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px", color: "#19202E" }}>
                      ₹{rate.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </span>
                    <span style={{ fontSize: 12.5, color: "#8A93A6" }}>/kg ex-GST</span>
                  </div>
                  {kg > 1 && (
                    <div style={{ fontSize: 12.5, color: "#56627A" }}>{fmt(p.price)} incl. GST per {p.attrs?.Lot} lot ({kg.toLocaleString("en-IN")} kg)</div>
                  )}
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: "#4E5BDC", marginTop: "auto" }}>Live rate, charts &amp; details →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Exchange context ── */}
      <MetalsMarketCharts />

      {/* ── Always-on data access (beta interest capture) ── */}
      <section style={{ ...card, padding: "28px 30px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }} className="metals-data-grid">
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Data access</div>
          <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", margin: "4px 0 10px", color: "#19202E" }}>
            Need this data reliably, all the time?
          </h2>
          <p style={{ fontSize: 13.5, color: "#56627A", lineHeight: 1.6, margin: 0 }}>
            We are building always-on access to our metals rates and market data: dependable feeds, alerts and
            history beyond what this beta page shows. If steady access matters to your business, tell us who you
            are and what you need. Your requirements shape what we build first, and you get access as it rolls out.
          </p>
        </div>
        <LeadForm
          action={submitPartnerLead.bind(null, "metals-data")}
          fields={[
            { name: "name", label: "Your name", required: true, half: true },
            { name: "company", label: "Company", half: true },
            { name: "email", label: "Email", type: "email", required: true, half: true },
            { name: "phone", label: "Phone", type: "tel", half: true },
            { name: "message", label: "What data do you need, and how often?", type: "textarea", placeholder: "e.g. Copper CCR rod rate every morning, LME trend history, alerts on ±2% moves…" },
          ]}
          submitLabel="Request data access"
          footnote="We'll only use this to reach you about metals data access."
        />
      </section>

      {/* ── Enquiry metals ── */}
      <section>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Sourcing desk</div>
        <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", margin: "4px 0 8px", color: "#19202E" }}>
          Every other metal, on enquiry
        </h2>
        <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 16px", lineHeight: 1.55, maxWidth: 700 }}>
          Tell us the grade, quantity and delivery point - our desk responds with a firm quote. Enquiries are
          GSTIN-verified so genuine trade buyers get priority.
        </p>
        {groups.map((g) => (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#56627A", margin: "0 0 8px" }}>{g}</div>
            <div className="metals-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {METALS_TAXONOMY.filter((m) => m.group === g).map((m) => (
                <Link
                  key={m.name}
                  href={m.live ? "#top" : `/metals/enquiry?metal=${encodeURIComponent(m.name)}`}
                  style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}
                >
                  <span style={{ fontSize: 18 }}>{METAL_ICONS[m.name]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{m.name}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: m.live ? "#1F9D63" : "#4E5BDC" }}>
                    {m.live ? "Buy ↑" : "Enquire →"}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── FAQ (mirrors the FAQPage JSON-LD above) ── */}
      <section>
        <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 14px", color: "#19202E" }}>
          Copper buying, answered
        </h2>
        <div style={{ display: "grid", gap: 10 }}>
          {FAQS.map(([q, a]) => (
            <details key={q} style={{ ...card, padding: "16px 20px" }}>
              <summary style={{ fontSize: 14, fontWeight: 700, color: "#19202E", cursor: "pointer" }}>{q}</summary>
              <p style={{ fontSize: 13.5, color: "#56627A", lineHeight: 1.6, margin: "10px 0 0" }}>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ── How buying works ── */}
      <section style={{ ...card, padding: "26px 28px" }}>
        <h2 style={{ fontFamily: GROTESK, fontSize: 18, fontWeight: 600, letterSpacing: "-0.4px", margin: "0 0 14px", color: "#19202E" }}>
          How buying copper works
        </h2>
        <div className="metals-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {[
            ["1", "Verify your business", "Copper orders need a business account with your GSTIN - a one-time signup."],
            ["2", "Lock today's rate", "Book online with a 5% advance via Razorpay. The rate is locked the moment you book."],
            ["3", "Settle by RTGS", "Pay the balance by RTGS to our account - bank details arrive with the booking confirmation."],
            ["4", "Dispatch & GST invoice", "Material dispatches on payment confirmation with a full GST tax invoice."],
          ].map(([n, t, b]) => (
            <div key={n}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "#EEF0FD", color: "#4E5BDC", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>{n}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{t}</div>
              <div style={{ fontSize: 12, color: "#56627A", lineHeight: 1.5, marginTop: 3 }}>{b}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
