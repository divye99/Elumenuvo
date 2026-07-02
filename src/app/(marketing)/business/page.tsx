import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elume for Business — B2B FMEG procurement for India",
  description:
    "Cut 15–25% off electrical procurement. Elume gives builders and contractors one catalogue, live brand comparison, staged POs and 30-day credit — see how it works.",
  alternates: { canonical: "https://elumenuvo.com/business" },
  openGraph: {
    title: "Elume for Business — B2B FMEG procurement",
    description: "One catalogue, live brand comparison, staged POs and credit.",
    url: "https://elumenuvo.com/business",
    type: "website",
  },
};

export default async function BusinessPage() {
  const content = await getSiteContent();
  return <Landing content={content} />;
}
