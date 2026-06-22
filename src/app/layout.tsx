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

export const metadata: Metadata = {
  title: "Elume — India's procurement backbone for FMEG",
  description:
    "The dedicated B2B storefront for electrical goods — multi-brand catalogue, transparent pricing, embedded credit, and project-level procurement tools.",
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
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
