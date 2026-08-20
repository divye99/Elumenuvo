import { Analytics } from "@vercel/analytics/next";
import { jsonLd as toJsonLd } from "@/lib/jsonld";
import SiteTracker from "@/components/SiteTracker";
import { Suspense } from "react";
import GoogleTag from "@/components/GoogleTag";
import type { Metadata } from "next";
import { Hanken_Grotesk, Space_Grotesk, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { ORG } from "@/lib/seo";
import "./globals.css";

// Typography stays on the original stack (owner call, Aug 2026: the identity
// kit's General Sans was tried sitewide and reverted): Hanken Grotesk for
// body text, Space Grotesk for headings, Space Mono for SKU chips. General
// Sans remains the PRINT/collateral face (brochures, og image).
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const SITE = "https://elumenuvo.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Elume - India's Premier Electrical Marketplace",
    template: "%s · Elume",
  },
  description:
    "India's premier marketplace for wires, cables, switchgear, lighting, fans and modular electrical products - 24+ brands at transparent, market-checked prices with GST invoice, wholesale rates and pan-India delivery.",
  keywords: [
    "FMEG procurement", "electrical goods India", "house wires", "switchgear", "MCB", "RCCB",
    "modular switches", "distribution boards", "ceiling fans", "LED lighting", "B2B electrical",
    "wholesale electrical India", "Havells", "Polycab", "CMI wires",
  ],
  applicationName: "Elume",
  authors: [{ name: "Elume Nuvotech Private Limited" }],
  // No root-level canonical: pages that skip `alternates` were inheriting
  // canonical = homepage, telling Google they are duplicates of "/". Every
  // indexable page declares its own canonical already.
  openGraph: {
    type: "website",
    siteName: "Elume",
    title: "Elume - India's Premier Electrical Marketplace",
    description: "Wires, cables, switchgear, lighting, fans and modular from 24+ brands at one transparent price list.",
    url: SITE,
    images: [{ url: `${SITE}/og.png`, width: 1200, height: 630, alt: "Elume" }],
  },
  twitter: { card: "summary_large_image", title: "Elume - India's Premier Electrical Marketplace", description: "Multi-brand electrical goods with transparent pricing.", images: [`${SITE}/og.png`] },
  robots: { index: true, follow: true },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  ...ORG,
  description: "B2B procurement platform for Fast-Moving Electrical Goods (FMEG) in India.",
  areaServed: "IN",
};

// NOTE: the WebSite node lives ONLY on the homepage (lib/seo.ts WEBSITE,
// emitted by (marketing)/page.tsx). It used to be duplicated here site-wide
// with conflicting fields, which is exactly what Google's site-name docs warn
// against - never re-add it to the layout.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${hanken.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body>
        <Suspense fallback={null}>
          <SiteTracker />
        </Suspense>
        <Analytics />
        <GoogleTag />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(ORG_JSONLD) }} />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
