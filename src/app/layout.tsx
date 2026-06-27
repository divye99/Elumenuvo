import type { Metadata } from "next";
import { Hanken_Grotesk, Space_Grotesk, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

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
    default: "Elume — India's procurement backbone for FMEG",
    template: "%s · Elume",
  },
  description:
    "The dedicated B2B storefront for electrical goods in India — multi-brand catalogue (wires, switchgear, fans, lighting), transparent pricing, wholesale rates and project-level procurement tools.",
  keywords: [
    "FMEG procurement", "electrical goods India", "house wires", "switchgear", "MCB", "RCCB",
    "modular switches", "distribution boards", "ceiling fans", "LED lighting", "B2B electrical",
    "wholesale electrical India", "Havells", "Polycab", "CMI wires",
  ],
  applicationName: "Elume",
  authors: [{ name: "Elume Nuvotech Private Limited" }],
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    siteName: "Elume",
    title: "Elume — India's procurement backbone for FMEG",
    description: "Multi-brand electrical goods catalogue with transparent pricing and wholesale rates.",
    url: SITE,
  },
  twitter: { card: "summary_large_image", title: "Elume — FMEG procurement, India", description: "Multi-brand electrical goods with transparent pricing." },
  robots: { index: true, follow: true },
};

const ORG_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Elume",
  legalName: "Elume Nuvotech Private Limited",
  url: SITE,
  logo: `${SITE}/assets/elume-mark.png`,
  description: "B2B procurement platform for Fast-Moving Electrical Goods (FMEG) in India.",
  areaServed: "IN",
  sameAs: [] as string[],
};

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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSONLD) }} />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
