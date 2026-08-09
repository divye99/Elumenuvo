import type { Metadata } from "next";
import CatalogueBrowser from "@/components/storefront/CatalogueBrowser";
import BuyAgainShelf from "@/components/storefront/BuyAgainShelf";
import { fetchProducts } from "@/lib/products";
import { getEditorialPicks } from "@/lib/blog";
import { loadSearchSignals } from "@/lib/search-signals";

// ISR: the catalogue data is shared by everyone; serving it cached makes
// search navigations near-instant (the browser filters client-side anyway).
// Reading URL params moved client-side so this page can stay static.
// 1h window (was 5min - Vercel ISR-write blowout, Aug 2026); product changes
// revalidate on demand via the products cache tag, so this is only a safety net.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "FMEG Catalogue - wires, switchgear, fans & lighting (India)",
  description:
    "Browse multi-brand electrical goods in India: house wires, switchgear, modular switches, distribution boards, fans and LED lighting. MRP, Elume price and wholesale rates on every product.",
  alternates: { canonical: "https://elumenuvo.com/catalogue" },
  openGraph: {
    siteName: "Elume",
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }], title: "Elume FMEG Catalogue", description: "Multi-brand electrical goods with transparent pricing.", url: "https://elumenuvo.com/catalogue", type: "website" },
};

export default async function CataloguePage() {
  const [products, signals] = await Promise.all([fetchProducts(), loadSearchSignals()]);
  // key: the shelf element crosses the server->client boundary as a prop and
  // lands in <main>'s children array un-validated; without an explicit key
  // React warns "missing key ... passed a child from CataloguePage" on every
  // catalogue render.
  return <CatalogueBrowser products={products} editorial={getEditorialPicks()} searchBoost={signals.pickTotals} personalShelf={<BuyAgainShelf key="buy-again" />} />;
}
