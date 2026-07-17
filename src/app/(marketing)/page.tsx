import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import HomeStorefront from "@/components/storefront/HomeStorefront";
import { fetchProducts } from "@/lib/products";
import { getAllPosts } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elume — Buy electrical goods online in India | Wires, MCBs, Switches, Fans, Lights",
  description:
    "India's FMEG store: house wires, MCBs & switchgear, modular switches, distribution boards, fans and LED lighting from Havells, Polycab, Finolex, CMI and more. MRP, Elume price and wholesale rates on every product.",
  alternates: { canonical: "https://elumenuvo.com" },
  openGraph: {
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }],
    title: "Elume — Buy electrical goods online in India",
    description: "Every electrical brand. One transparent price list.",
    url: "https://elumenuvo.com",
    type: "website",
  },
};

export default async function Page() {
  const products = await fetchProducts();
  return (
    <StoreChrome>
      <HomeStorefront products={products} posts={getAllPosts()} />
    </StoreChrome>
  );
}
