import type { Metadata } from "next";
import CatalogueBrowser from "@/components/storefront/CatalogueBrowser";
import { fetchProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FMEG Catalogue — wires, switchgear, fans & lighting (India)",
  description:
    "Browse multi-brand electrical goods in India: house wires, switchgear, modular switches, distribution boards, fans and LED lighting. MRP, Elume price and wholesale rates on every product.",
  alternates: { canonical: "https://elumenuvo.com/catalogue" },
  openGraph: { title: "Elume FMEG Catalogue", description: "Multi-brand electrical goods with transparent pricing.", url: "https://elumenuvo.com/catalogue", type: "website" },
};

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cat?: string; sort?: string }>;
}) {
  const [{ q, cat, sort }, products] = await Promise.all([searchParams, fetchProducts()]);
  return <CatalogueBrowser products={products} initialQ={q ?? ""} initialCat={cat ?? "All"} initialSort={sort ?? "featured"} />;
}
