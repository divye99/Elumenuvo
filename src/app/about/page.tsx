import type { Metadata } from "next";
import Link from "next/link";
import InfoPage from "@/components/storefront/InfoPage";
import { COMPANY, addressLine, officeLine } from "@/lib/company";
import { fetchProductsLite } from "@/lib/products";
import { slugify } from "@/lib/slug";

/**
 * /about: the full company story (owner brief, Aug 2026): what Elume is, who
 * founded it, the problem it solves, why it exists, brands, categories, where
 * it operates, company registration and contact. Brand and category lists are
 * derived from the live catalogue so the page never quotes a stale count.
 * The intro deliberately co-locates "Elume", "Elumenuvo", the domain and the
 * legal entity in indexable text: it disambiguates the brand for Google
 * against elume.in and the "elumelu" typo-correction.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "About Elume - India's Premier Electrical Marketplace" },
  description:
    "Elume (elumenuvo.com) is India's premier online marketplace for electrical goods: wires and cables, switchgear, lighting, fans and modular products from 24+ brands. Who founded it, the problem it solves, and the company behind it.",
  alternates: { canonical: "https://elumenuvo.com/about" },
};

export default async function AboutPage() {
  const all = await fetchProductsLite();
  const brands = [...new Set(all.map((p) => p.brand))].sort();
  const cats = [...new Set(all.map((p) => p.cat))].sort();
  const skuCount = all.length;

  const link = { color: "#4E5BDC", fontWeight: 600 } as const;

  return (
    <InfoPage
      kicker="About Elume"
      title="India's premier electrical marketplace"
      intro="Elume (elumenuvo.com), sometimes written Elumenuvo, is operated by Elume Nuvotech Private Limited. We sell genuine electrical goods online, from house wires to switchgear to designer modular switches, at one transparent price list, to homes, electricians, contractors and businesses across India."
      updated="20 August 2026"
      sections={[
        {
          h: "What Elume is",
          body: (
            <>
              Elume is a multi-brand online marketplace for electrical goods. Right now the shelf carries{" "}
              <b>{skuCount.toLocaleString("en-IN")} live listings</b> across <b>{brands.length} brands</b> and{" "}
              <b>{cats.length} categories</b>, every one priced on a single public price list: the ex-GST price, the
              GST amount and the inclusive total shown before you pay, with a wholesale rate applying automatically on
              15 units or more. We check our prices against brand and marketplace pricing daily and keep them at or
              below market wherever we can, with no inflated strike-through games.
            </>
          ),
        },
        {
          h: "Why Elume exists",
          body: (
            <>
              Buying electrical goods in India has always meant asking someone what the price is. The same wire, the
              same switch, the same MCB sells at a different rate depending on who is asking, which shop they walked
              into and what mood the market is in that week. After years working abroad in retail and finance, our
              founders came home to the same opaque counters they grew up around, and started Elume to fix it: first as
              an idea for a wires-and-cables price-tracking store, then as a full electrical marketplace.
              <br />
              <br />
              The mission has not changed since day one: give every buyer, whether a homeowner buying one fan or a
              contractor buying four hundred metres of cable, access to honest, transparent pricing and products they
              can trust.
            </>
          ),
        },
        {
          h: "The problem we solve",
          body: (
            <>
              Electrical distribution in India runs through three to four layers of intermediaries, on phone calls,
              paper quotes and WhatsApp. There is no standard price: rates differ by buyer, rebates and credit terms are
              informal, and small buyers pay the most. Elume replaces that with a published price list, spec sheets and
              buying guides you can read yourself, a GST invoice on every order, and doorstep delivery, so the price you
              see is the price everyone gets. For project buyers, our{" "}
              <Link href="/bulk-enquiry" style={link}>bulk enquiry desk</Link> turns a raw BOQ into one consolidated
              multi-brand quote within 24 hours.
            </>
          ),
        },
        {
          h: "Who founded Elume",
          body: (
            <>
              Elume was founded by two brothers-in-trade with complementary backgrounds and four decades of family
              history in wires-and-cables manufacturing behind them.
              <br />
              <br />
              <b>Divye Jain, Co-founder &amp; CEO</b>: economics at King&apos;s College London and marketing at the London
              School of Economics, then Amazon&apos;s retail division in London, where he scaled a niche brand account from
              under $1M to roughly $5M in annual sales in two years, with earlier commercial planning work at LVMH.
              <br />
              <br />
              <b>Ansh Jain, Co-founder</b>: economics at UC Irvine, then a derivatives trader at Goldman Sachs in the
              US, bringing the risk, credit and quantitative discipline behind Elume&apos;s pricing engine.
            </>
          ),
        },
        {
          h: "Brands available",
          body: (
            <>
              We list genuine, branded products sourced through the trade and sold new, in original packaging, with the
              manufacturer&apos;s warranty intact. Brands currently live on the shelf:
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
                {brands.map((b) => (
                  <Link key={b} href={`/brand/${slugify(b)}`} style={{ fontSize: 12, fontWeight: 600, color: "#3A4358", background: "#F3F5F9", border: "1px solid #E4E7EF", borderRadius: 8, padding: "4px 10px" }}>
                    {b}
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                We are not the manufacturer of third-party brands and do not claim to be their authorised distributor
                unless stated on the product page. Elume-branded house wires are our own label.
              </div>
            </>
          ),
        },
        {
          h: "Product categories",
          body: (
            <>
              Everything an electrical project needs, in one cart:
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 12 }}>
                {cats.map((c) => (
                  <Link key={c} href={`/category/${slugify(c)}`} style={{ fontSize: 12, fontWeight: 600, color: "#3A4358", background: "#F3F5F9", border: "1px solid #E4E7EF", borderRadius: 8, padding: "4px 10px" }}>
                    {c}
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                Plus a growing <Link href="/metals" style={link}>Metals</Link> desk (copper, in beta) and{" "}
                <Link href="/blog" style={link}>50+ buying guides</Link> written to help you spec the right product
                before you spend.
              </div>
            </>
          ),
        },
        {
          h: "Where we operate",
          body: (
            <>
              Elume is online-first and delivers pan-India, typically within 3 to 7 working days, through integrated
              courier partners covering 19,000+ pincodes, heavy freight like wire coils and distribution boards
              included. Delivery is free on orders of ₹4,000 and above, with a small flat fee below that. Operations run
              from Uttar Pradesh: the registered office in Hapur and a working office in Noida (NCR).
            </>
          ),
        },
        {
          h: "Company details",
          body: (
            <>
              This store is owned and operated by <b>{COMPANY.legalName}</b>, a company incorporated in India under
              Corporate Identity Number <b>{COMPANY.cin}</b>, GSTIN <b>{COMPANY.gstin}</b>, and recognised as a startup
              under the Government of Uttar Pradesh&apos;s StartInUP programme.
              <br />
              <br />
              <b>Registered office:</b> {addressLine()} - this is also where returns are sent.
              <br />
              <b>Additional office:</b> {officeLine(COMPANY.additionalOffice)}
              <br />
              <br />
              Every order is invoiced by {COMPANY.legalName} with GST shown separately, so what you buy here is backed
              by a registered Indian company with a verifiable address, not an anonymous storefront. Payments run
              through Razorpay (UPI, cards, net banking and wallets); we never see or store your card details.
            </>
          ),
        },
        {
          h: "Contact details",
          body: (
            <>
              We are a small team and we answer our own email and phone. Reach us at{" "}
              <a href={`mailto:${COMPANY.email}`} style={link}>{COMPANY.email}</a> or{" "}
              <a href={`tel:${COMPANY.phone}`} style={link}>{COMPANY.phoneDisplay}</a>, {COMPANY.hours.toLowerCase()}.
              For volume requirements use the <Link href="/bulk-enquiry" style={link}>bulk enquiry form</Link> (response
              within 24 hours). Full contact details, including our postal address, are on the{" "}
              <Link href="/contact" style={link}>contact page</Link>, and we are on{" "}
              <a href="https://www.facebook.com/profile.php?id=61592404302026" style={link} rel="noopener noreferrer" target="_blank">Facebook</a>,{" "}
              <a href="https://www.instagram.com/elumenuvo/" style={link} rel="noopener noreferrer" target="_blank">Instagram</a> and{" "}
              <a href="https://www.youtube.com/@ElumeNuvo" style={link} rel="noopener noreferrer" target="_blank">YouTube</a>.
            </>
          ),
        },
      ]}
    />
  );
}
