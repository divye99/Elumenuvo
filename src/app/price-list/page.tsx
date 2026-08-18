import type { Metadata } from "next";
import Link from "next/link";
import { fetchProductsLite } from "@/lib/products";
import { listPriceListCombos } from "@/lib/price-list";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Brand Price Lists 2026: Wires, Switchgear, Fans, Lighting (India)",
  description:
    "Live price lists for every brand and category we stock: Havells, Polycab, KEI, ABB, Lauritz Knudsen, Orient, Crompton and more. Real selling prices with GST invoice, updated from our catalogue daily.",
  alternates: { canonical: "https://elumenuvo.com/price-list" },
};

export default async function PriceListIndex() {
  const all = await fetchProductsLite();
  const combos = listPriceListCombos(all);
  const brands = [...new Set(combos.map((c) => c.brand))];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 20px 64px" }}>
      <nav style={{ fontSize: 13, color: "#8A93A6", marginBottom: 14 }}>
        <Link href="/" style={{ color: "#8A93A6" }}>Home</Link> / Price lists
      </nav>
      <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: -0.5, margin: "0 0 10px" }}>
        Brand price lists, straight from our live catalogue
      </h1>
      <p style={{ fontSize: 15, color: "#5B6474", lineHeight: 1.65, maxWidth: 760, margin: "0 0 28px" }}>
        These are our actual selling prices, the same ones you can order at, kept current by the
        catalogue itself rather than a PDF that ages the day it is printed. Every item links to its
        product page with photos, specifications and a GST invoice on purchase.
      </p>
      {brands.map((brand) => {
        const mine = combos.filter((c) => c.brand === brand);
        return (
          <section key={brand} style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 10px" }}>{brand}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {mine.map((c) => (
                <Link
                  key={c.slug}
                  href={`/price-list/${c.slug}`}
                  style={{
                    display: "inline-block", padding: "10px 14px", borderRadius: 10,
                    border: "1px solid #E3E7EF", background: "#fff", color: "#232A36",
                    fontSize: 14, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  {c.brand} {c.cat} price list <span style={{ color: "#8A93A6", fontWeight: 500 }}>({c.count})</span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
