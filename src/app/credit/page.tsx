import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import WaitlistForm from "@/components/storefront/WaitlistForm";
import { GROTESK, MONO } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "30-day NBFC Credit — coming soon",
  description:
    "Elume is building 30-day purchase credit for electrical procurement with NBFC partners. Join the waitlist to get early access when it launches.",
  alternates: { canonical: "https://elumenuvo.com/credit" },
  openGraph: {
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }],
    title: "Elume Credit — 30-day NBFC credit for FMEG procurement",
    description: "Buy now, pay in 30 days. Coming soon — join the waitlist.",
    url: "https://elumenuvo.com/credit",
    type: "website",
  },
};

const PERKS = [
  { icon: "🗓️", title: "30-day terms", body: "Order today, pay after your billing cycle — matched to how site work actually gets paid." },
  { icon: "🏦", title: "NBFC-backed", body: "Credit lines underwritten by regulated NBFC partners, not informal khata balances." },
  { icon: "⚡", title: "Instant at checkout", body: "Approved buyers pick “Elume Credit” at checkout — no paperwork per order." },
  { icon: "🚚", title: "Works pan-India", body: "Same credit line across every site and state you order to." },
];

export default function CreditPage() {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 28px 72px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 40, alignItems: "start" }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "1.6px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 12 }}>
              In development · launching soon
            </div>
            <h1 style={{ fontFamily: GROTESK, fontSize: 40, fontWeight: 600, letterSpacing: "-1.2px", lineHeight: 1.1, margin: 0 }}>
              Buy now.
              <br />
              Pay in 30 days.
            </h1>
            <p style={{ fontSize: 15.5, color: "#56627A", lineHeight: 1.6, margin: "16px 0 28px", maxWidth: 520 }}>
              We&apos;re building <strong>Elume Credit</strong> — a 30-day purchase credit line with NBFC
              partners, so contractors and builders can order electrical materials against running
              projects instead of locking up working capital.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {PERKS.map((f) => (
                <div key={f.title} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
                  <div style={{ fontSize: 20, marginBottom: 8 }}>{f.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#19202E" }}>{f.title}</div>
                  <div style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.5, marginTop: 4 }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 18, padding: "26px 26px 22px", boxShadow: "0 14px 40px rgba(20,24,45,.08)", position: "sticky", top: 92 }}>
            <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, letterSpacing: "-0.3px", marginBottom: 6 }}>
              Get early access
            </div>
            <p style={{ fontSize: 13, color: "#56627A", margin: "0 0 18px", lineHeight: 1.5 }}>
              Join the waitlist and we&apos;ll onboard you first when credit goes live.
            </p>
            <WaitlistForm />
          </div>
        </div>
      </main>
    </StoreChrome>
  );
}
