import type { Metadata } from "next";
import CatalogueBrowser from "@/components/storefront/CatalogueBrowser";
import { fetchProducts } from "@/lib/products";
import { getEditorialPicks } from "@/lib/blog";
import { loadSearchSignals } from "@/lib/search-signals";

// ISR: the catalogue data is shared by everyone; serving it cached makes
// search navigations near-instant (the browser filters client-side anyway).
// Reading URL params moved client-side so this page can stay static.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "FMEG Catalogue — wires, switchgear, fans & lighting (India)",
  description:
    "Browse multi-brand electrical goods in India: house wires, switchgear, modular switches, distribution boards, fans and LED lighting. MRP, Elume price and wholesale rates on every product.",
  alternates: { canonical: "https://elumenuvo.com/catalogue" },
  openGraph: {
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }], title: "Elume FMEG Catalogue", description: "Multi-brand electrical goods with transparent pricing.", url: "https://elumenuvo.com/catalogue", type: "website" },
};

export default async function CataloguePage() {
  const [products, signals] = await Promise.all([fetchProducts(), loadSearchSignals()]);
  return <CatalogueBrowser products={products} editorial={getEditorialPicks()} searchBoost={signals.pickTotals} />;
}
