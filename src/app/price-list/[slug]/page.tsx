import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProducts, fetchProductsLite } from "@/lib/products";
import { listPriceListCombos, comboFromSlug, priceListRows } from "@/lib/price-list";
import { gstBreakdown, gstRateFor } from "@/lib/pricing";
import { jsonLd } from "@/lib/jsonld";
import { slugify } from "@/lib/slug";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  const all = await fetchProductsLite();
  return listPriceListCombos(all).map((c) => ({ slug: c.slug }));
}

const YEAR = 2026;
const fmtInr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const all = await fetchProductsLite();
  const combo = comboFromSlug(all, slug);
  if (!combo) notFound();
  const rows = priceListRows(all, combo);
  const prices = rows.map((p) => Number(p.price));
  const lo = Math.min(...prices), hi = Math.max(...prices);
  return {
    title: `${combo.brand} ${combo.cat} Price List ${YEAR}: ${rows.length} Prices (India)`,
    description: `Current ${combo.brand} ${combo.cat.toLowerCase()} prices in India, from ${fmtInr(lo)} to ${fmtInr(hi)}. Live selling prices with GST invoice, not an outdated PDF; every row links to the product page to order.`,
    alternates: { canonical: `https://elumenuvo.com/price-list/${combo.slug}` },
  };
}

export default async function PriceListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Card columns, not lite: the table renders brand_sku, which LITE_COLS skips.
  const all = await fetchProducts();
  const combo = comboFromSlug(all, slug);
  if (!combo) notFound();
  const rows = priceListRows(all, combo);
  const prices = rows.map((p) => Number(p.price));
  const lo = Math.min(...prices), hi = Math.max(...prices);
  const gstPct = Math.round(gstRateFor(combo.cat) * 100);
  const updated = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const siblings = listPriceListCombos(all).filter((c) => c.slug !== combo.slug && (c.brand === combo.brand || c.cat === combo.cat)).slice(0, 8);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://elumenuvo.com" },
      { "@type": "ListItem", position: 2, name: "Price lists", item: "https://elumenuvo.com/price-list" },
      { "@type": "ListItem", position: 3, name: `${combo.brand} ${combo.cat}`, item: `https://elumenuvo.com/price-list/${combo.slug}` },
    ],
  };
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${combo.brand} ${combo.cat} price list ${YEAR}`,
    numberOfItems: rows.length,
    itemListElement: rows.slice(0, 50).map((p, i) => ({
      "@type": "ListItem", position: i + 1, name: p.name,
      url: `https://elumenuvo.com/catalogue/${p.id}`,
    })),
  };

  const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", fontSize: 12, fontWeight: 700, color: "#5B6474", borderBottom: "2px solid #E3E7EF", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "9px 10px", fontSize: 13.5, borderBottom: "1px solid #EEF1F6", verticalAlign: "top" };

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(itemListLd) }} />
      <nav style={{ fontSize: 13, color: "#8A93A6", marginBottom: 14 }}>
        <Link href="/" style={{ color: "#8A93A6" }}>Home</Link> / <Link href="/price-list" style={{ color: "#8A93A6" }}>Price lists</Link> / {combo.brand} {combo.cat}
      </nav>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, margin: "0 0 10px" }}>
        {combo.brand} {combo.cat} Price List {YEAR}
      </h1>
      <p style={{ fontSize: 15, color: "#5B6474", lineHeight: 1.65, maxWidth: 780, margin: "0 0 6px" }}>
        {rows.length} current {combo.brand} {combo.cat.toLowerCase()} prices, from {fmtInr(lo)} to {fmtInr(hi)}.
        These are our live selling prices, the same numbers you order at, so the list never goes stale
        the way dealer PDFs do. Prices include {gstPct}% GST; the ex-GST value businesses claim as input
        credit is shown alongside. Every row opens the product page with photos, specifications and stock.
      </p>
      <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 22px" }}>Updated {updated} · Prices include GST · GST invoice on every order</p>
      <div style={{ overflowX: "auto", border: "1px solid #E3E7EF", borderRadius: 12, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            <tr>
              <th style={th}>Product</th>
              <th style={th}>Brand SKU</th>
              <th style={{ ...th, textAlign: "right" }}>Price (incl. GST)</th>
              <th style={{ ...th, textAlign: "right" }}>Ex-GST</th>
              <th style={{ ...th, textAlign: "right" }}>MRP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const incl = Number(p.price);
              const { base } = gstBreakdown(incl, p.cat, p.gstRate ?? null);
              const mrp = Number(p.market);
              return (
                <tr key={p.id}>
                  <td style={td}>
                    <Link href={`/catalogue/${p.id}`} style={{ color: "#232A36", fontWeight: 600, textDecoration: "none" }}>{p.name}</Link>
                    {p.spec ? <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 2 }}>{p.spec.replace(/^Per Google demand data\s*·\s*/i, "")}</div> : null}
                  </td>
                  <td style={{ ...td, fontSize: 12.5, color: "#5B6474", fontFamily: "var(--font-space-mono), monospace" }}>{p.brandSku ?? "-"}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtInr(incl)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#5B6474" }}>{fmtInr(base)}</td>
                  <td style={{ ...td, textAlign: "right", color: "#8A93A6" }}>{mrp > incl ? fmtInr(mrp) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 13, color: "#5B6474", lineHeight: 1.6, maxWidth: 780, margin: "18px 0 0" }}>
        Need bulk or project quantities? <Link href="/wholesale" style={{ color: "#4053B8" }}>Wholesale rates</Link> apply
        automatically above the threshold quantities, and our <Link href="/business" style={{ color: "#4053B8" }}>business accounts</Link> add
        BOQ tools and credit options. Browse the full {" "}
        <Link href={`/category/${slugify(combo.cat)}?facet=${encodeURIComponent(combo.brand)}`} style={{ color: "#4053B8" }}>
          {combo.brand} {combo.cat} range
        </Link>{" "}with photos and filters.
      </p>
      {siblings.length ? (
        <section style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: "0 0 10px" }}>Related price lists</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {siblings.map((c) => (
              <Link key={c.slug} href={`/price-list/${c.slug}`} style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid #E3E7EF", background: "#fff", color: "#232A36", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                {c.brand} {c.cat}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
