import type { Metadata } from "next";
import { Inter } from "next/font/google";

/**
 * Elumenuvo (space procurement) segment layout.
 *
 * Scopes the Inter font + navy theme to the /space subtree so it keeps its own
 * visual identity without affecting the Elume (FMEG) pages, which use Hanken
 * Grotesk + the indigo palette. Overriding --font-sans on the wrapper makes
 * Tailwind's `font-sans` resolve to Inter inside this segment only.
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elumenuvo — Space Procurement, so your team can build",
    template: "%s · Elumenuvo",
  },
  description:
    "Elumenuvo is a procurement partner built for India's space companies. We source what you need, manage your vendors, and handle imports and customs.",
};

export default function SpaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={inter.variable}
      style={
        {
          "--font-sans": "var(--font-inter-loaded)",
          fontFamily: "var(--font-inter-loaded)",
          background: "#fff",
          color: "var(--color-navy)",
          minHeight: "100vh",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
