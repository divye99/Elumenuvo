import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProduct } from "@/lib/products";
import { getProfile, isBusiness } from "@/lib/profile";
import { isMetalCategory } from "@/lib/metals";
import { gstRateFor } from "@/lib/pricing";
import { onlinePaymentAvailable } from "@/lib/order-actions";
import { getMetalsBank } from "../actions";
import BookingClient from "./BookingClient";
import { GROTESK } from "@/lib/fonts";

/**
 * Copper booking (business-gated, per-visitor) - deliberately DYNAMIC, unlike
 * the cached PDPs: the page itself decides sign-in / business-profile /
 * ready-to-book states server-side, so the gate cannot be skipped by a stale
 * cached shell.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book copper at today's rate",
  robots: { index: false }, // checkout-like page; the PDP is the search surface
};

function Gate({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "60px 30px 80px", textAlign: "center" }}>
      <div style={{ fontSize: 38 }}>🔒</div>
      <h1 style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, letterSpacing: "-0.6px", margin: "14px 0 10px", color: "#19202E" }}>{title}</h1>
      <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.6, margin: "0 0 22px" }}>{body}</p>
      <Link href={href} style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "12px 22px", borderRadius: 11 }}>
        {cta}
      </Link>
    </main>
  );
}

export default async function BookCopperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, profile, online, bank] = await Promise.all([fetchProduct(id), getProfile(), onlinePaymentAvailable(), getMetalsBank()]);
  if (!product || !isMetalCategory(product.cat) || product.inStock === false) notFound();

  if (!profile) {
    return (
      <Gate
        title="Sign in to book copper"
        body="Copper bookings are for verified business buyers. Sign in to your Elume account (or create one) and you'll be back here in a minute."
        cta="Sign in →"
        href="/signin"
      />
    );
  }
  if (!isBusiness(profile) || !profile.gstin) {
    return (
      <Gate
        title="A business account is needed"
        body="Copper sells in commercial lots, so we verify every buyer's GSTIN before booking. Upgrade to a business account with your GSTIN - it takes two minutes."
        cta="Set up my business account →"
        href="/business"
      />
    );
  }

  return (
    <BookingClient
      product={{
        id: product.id,
        name: product.name,
        lot: product.attrs?.Lot ?? null,
        attrs: product.attrs ?? null,
        unit: product.unit,
        price: product.price,
        gstRate: gstRateFor(product.cat, product.gstRate),
        image: product.image ?? null,
      }}
      buyer={{ name: profile.full_name || profile.company || "", company: profile.company || "", gstin: profile.gstin, email: profile.email, phone: profile.phone || "" }}
      online={online}
      bank={bank}
    />
  );
}
