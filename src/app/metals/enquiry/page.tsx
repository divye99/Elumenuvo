import type { Metadata } from "next";
import EnquiryClient from "./EnquiryClient";

export const metadata: Metadata = {
  title: "Metals enquiry - firm quotes for trade buyers",
  description:
    "Raise a GSTIN-verified enquiry for copper, aluminium, zinc, lead, nickel or steel. Our sourcing desk responds with a firm quote.",
  alternates: { canonical: "https://elumenuvo.com/metals/enquiry" },
};

export default async function MetalEnquiryPage({ searchParams }: { searchParams: Promise<{ metal?: string }> }) {
  const { metal } = await searchParams;
  return <EnquiryClient preselect={metal ?? ""} />;
}
