import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import TradeSurveyClient from "./TradeSurveyClient";

/** Trade survey for the builder/contractor/architect outreach. Linked from
 *  cold emails (UTM-tagged), rewards completion with the TRADE5 code. */
export const metadata: Metadata = {
  title: "Help us build a better electricals supplier · 2 minutes",
  robots: { index: false, follow: false }, // outreach-only page
};

export default function TradeSurveyPage() {
  return (
    <StoreChrome>
      <TradeSurveyClient />
    </StoreChrome>
  );
}
