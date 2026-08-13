import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StoreChrome from "@/components/storefront/StoreChrome";
import { getCompareGroupPage } from "@/lib/compare/pages";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import { fmt } from "@/lib/format";
import { gstBreakdown } from "@/lib/pricing";

/**
 * Programmatic SEO landing: one page per cross-brand like-to-like group.
 * "Compare 6 A 1-module switches: Legrand vs Norisys vs Havells" - the spec
 * table with live prices, FAQ + ItemList structured data, deep links into
 * every product page. Regenerates hourly; instantly correct after admin
 * edits via the shared products cache tag.
 */
export const revalidate = 3600;

export async function generateStaticParams() {
  return []; // fill on first request, serve from cache after
}

const SITE = "https://elumenuvo.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const g = await getCompareGroupPage(slug);
  if (!g) notFound();
  const title = `Compare ${g.title}: ${g.brands.slice(0, 3).join(" vs ")}${g.brands.length > 3 ? " & more" : ""} - prices & specs`;
  const description = `${g.members.length} ${g.title} with identical key specifications, compared side by side: ${g.brands.join(", ")}. Live prices, GST invoices, pan-India delivery.`;
  const url = `${SITE}/compare/${g.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { siteName: "Elume", title, description, url, type: "website" },
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = await getCompareGroupPage(slug);
  if (!g) notFound();

  const labels = g.members[0].display.map(([l]) => l);
  const specOf = (m: (typeof g.members)[number], label: string) => m.display.find(([l]) => l === label)?.[1] ?? "-";
  const cheapest = g.members[0];
  const priciest = g.members[g.members.length - 1];

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${g.title} compared`,
    itemListElement: g.members.map((m, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/catalogue/${m.id}`,
      name: m.name,
    })),
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `Which brand's ${g.title} is the cheapest?`,
        acceptedAnswer: { "@type": "Answer", text: `${cheapest.brand} is currently the lowest-priced at ${fmt(cheapest.price)} (incl. GST) for the ${cheapest.name}. Prices update daily.` },
      },
      {
        "@type": "Question",
        name: `Are these ${g.title} actually comparable?`,
        acceptedAnswer: { "@type": "Answer", text: `Yes - products appear on this page only when their key specifications match exactly (${labels.slice(0, 3).join(", ").toLowerCase()}). Colour and finish are the only differences we ignore.` },
      },
      {
        "@type": "Question",
        name: "Do prices include GST?",
        acceptedAnswer: { "@type": "Answer", text: "Catalogue prices are shown excluding GST with the GST-inclusive figure alongside; every order ships with a GST invoice." },
      },
    ],
  };

  return (
    <StoreChrome>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(itemList) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(faq) }} />
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "30px 24px 70px" }}>
        <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 12 }}>
          <Link href="/compare" style={{ color: "#8A93A6" }}>Compare</Link> &nbsp;/&nbsp; <span style={{ color: "#56627A", textTransform: "capitalize" }}>{g.title}</span>
        </div>
        <h1 style={{ fontSize: 25, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 6px", textTransform: "capitalize" }}>
          {g.title}: {g.brands.join(" vs ")}
        </h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 22px", maxWidth: 780 }}>
          {g.members.length} products with identical key specifications, priced side by side. Spread today:{" "}
          <b style={{ color: "#19202E" }}>{fmt(cheapest.price)}</b> to <b style={{ color: "#19202E" }}>{fmt(priciest.price)}</b> incl. GST.
          Tap any product for photos, price history and reviews.
        </p>

        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680, fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8A93A6", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <th style={{ padding: "11px 16px", fontWeight: 700 }}>Product</th>
                {labels.map((l) => <th key={l} style={{ padding: "11px 10px", fontWeight: 700 }}>{l}</th>)}
                <th style={{ padding: "11px 16px", fontWeight: 700, textAlign: "right" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {g.members.map((m, i) => {
                const gb = gstBreakdown(m.price, m.cat, m.gstRate);
                return (
                  <tr key={m.id} style={{ borderTop: "1px solid #F0F2F6", background: i === 0 ? "#FBFCFE" : undefined }}>
                    <td style={{ padding: "12px 16px", minWidth: 220 }}>
                      <Link href={`/catalogue/${m.id}`} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 44, height: 44, borderRadius: 8, flex: "none", background: m.image ? `center/contain no-repeat url(${m.image}) #fff` : "#F5F6F9", border: "1px solid #EEF0F4" }} />
                        <span>
                          <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#8A93A6" }}>{m.brand.toUpperCase()}</span>
                          <span style={{ fontWeight: 700, color: "#3A46B8", lineHeight: 1.3 }}>{m.name}</span>
                        </span>
                      </Link>
                    </td>
                    {labels.map((l) => <td key={l} style={{ padding: "12px 10px", color: "#3A4358", whiteSpace: "nowrap" }}>{specOf(m, l)}</td>)}
                    <td style={{ padding: "12px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 800 }}>{fmt(gb.base)}</span>
                      <span style={{ fontSize: 10.5, color: "#8A93A6" }}> +GST</span>
                      <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>{fmt(gb.incl)} incl. · /{m.unit}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 14, maxWidth: 780 }}>
          How this comparison works: products join this table only when every key specification matches
          exactly - colour and finish are the only differences ignored. Prices are our live catalogue
          prices and update as we reprice. Every order includes a GST invoice and pan-India delivery.
        </p>
      </main>
    </StoreChrome>
  );
}
