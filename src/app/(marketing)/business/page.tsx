import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";
import BusinessSignupForm from "@/components/storefront/BusinessSignupForm";
import { getSiteContent } from "@/lib/content";
import { getProfile, isBusiness } from "@/lib/profile";
import { GROTESK } from "@/lib/fonts";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Elume for Business — open a B2B account for FMEG procurement",
  description:
    "Open a business account with Elume: automatic GST invoicing on every order, wholesale rates built in, staged POs and 30-day credit. Cut 15–25% off electrical procurement.",
  alternates: { canonical: "https://elumenuvo.com/business" },
  openGraph: {
    title: "Elume for Business — open a B2B account",
    description: "Automatic GST invoicing, wholesale rates, staged POs and credit.",
    url: "https://elumenuvo.com/business",
    type: "website",
  },
};

const PERKS = [
  ["🧾", "GST invoicing, automatic", "Your GSTIN goes on every invoice. You're never asked for it at checkout again, and input tax credit is always claimable."],
  ["💰", "Wholesale rates built in", "Bulk tiers apply on their own. Order ₹30,000+ and an extra 5% comes off every unit, no negotiation needed."],
  ["🏗️", "Projects & staged POs", "Turn a BOQ into a priced BOM, compare every brand, and release purchase orders stage by stage."],
  ["💳", "30-day NBFC credit", "Buy now, pay after your billing cycle. Coming soon for approved business accounts."],
];

export default async function BusinessPage() {
  const [content, profile] = await Promise.all([getSiteContent(), getProfile()]);
  const alreadyBusiness = isBusiness(profile);

  return (
    <>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 28px 20px" }}>
        <div className="pd-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "start" }}>
          {/* Value proposition */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 10 }}>
              Elume for business
            </div>
            <h1 style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-0.9px", lineHeight: 1.15, margin: 0 }}>
              Procurement that pays for itself
            </h1>
            <p style={{ fontSize: 15, color: "#56627A", lineHeight: 1.6, margin: "14px 0 26px" }}>
              Contractors, builders and retailers cut 15–25% off electrical procurement on Elume by buying
              direct from one transparent price list, instead of through four layers of stacked margin.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {PERKS.map(([icon, title, body]) => (
                <div key={title} style={{ display: "flex", gap: 13, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{title}</div>
                    <p style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.55, margin: "3px 0 0" }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sign-up */}
          <div>
            {alreadyBusiness ? (
              <div style={{ background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 16, padding: "28px 26px" }}>
                <div style={{ fontSize: 26, marginBottom: 8 }}>✅</div>
                <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#166A44" }}>
                  {profile?.company} is set up
                </div>
                <p style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.6, margin: "8px 0 16px" }}>
                  You have a business account, so every order is GST-invoiced to{" "}
                  <b style={{ fontFamily: "var(--space-mono)" }}>{profile?.gstin}</b> automatically and wholesale
                  rates apply on their own. You&apos;ll never be asked for GST details at checkout.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link href="/app" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "11px 20px", borderRadius: 11 }}>Open your workspace →</Link>
                  <Link href="/catalogue" style={{ background: "#fff", color: "#4E5BDC", fontWeight: 700, fontSize: 13.5, padding: "11px 20px", borderRadius: 11, border: "1px solid #BEE7D2" }}>Start ordering</Link>
                </div>
              </div>
            ) : (
              <BusinessSignupForm signedIn={!!profile} existingCompany={profile?.company} />
            )}
          </div>
        </div>
      </main>

      {/* The existing marketing story stays below the fold */}
      <Landing content={content} />
    </>
  );
}
