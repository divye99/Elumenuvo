import { getAllPosts } from "@/lib/blog";

const SITE = "https://elumenuvo.com";

// Serves /llms.txt — a concise, machine-readable site guide for AI agents/LLMs.
export function GET() {
  const posts = getAllPosts();
  const body = `# Elume

> Elume (Elume Nuvotech Private Limited) is a B2B procurement platform for Fast-Moving Electrical Goods (FMEG) in India: wires & cables, switchgear (MCBs/RCCBs), modular switches, distribution boards, fans and LED lighting. Delivery is pan-India. Products carry verified-purchaser reviews scored on a 5-bolt "volt rating" (only buyers with a matching order can review), and many (e.g. house wires) come in variants by size, colour, length and quality grade. 30-day NBFC purchase credit is in development (waitlist: ${SITE}/credit). Pricing is transparent and GST-inclusive — every product shows MRP, the Elume selling price, and a wholesale rate (5% lower) on orders of 15+ units; GST billing (tax split out on the invoice) is available at checkout. Brands include Havells, Polycab, Finolex, Crompton, Legrand, Schneider, ABB, Syska, Anchor and CMI (CMI GreenShield house wires).

## Catalogue
- Browse all products: ${SITE}/catalogue
- Product detail pages: ${SITE}/catalogue/{product-id}

## Buying guides (blog)
${posts.map((p) => `- ${p.title}: ${SITE}/blog/${p.slug}`).join("\n")}

## Space procurement (sister vertical)
- Elumenuvo — procurement for India's space-tech companies: ${SITE}/space

## Credit (coming soon)
- 30-day NBFC credit waitlist: ${SITE}/credit

## Account
- Sign in to the buyer dashboard (orders, BOM, credit): ${SITE}/signin

## About
- Company: Elume Nuvotech Private Limited, India
- Sitemap: ${SITE}/sitemap.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
