import type { Metadata } from "next";
import Link from "next/link";
import StoreChrome from "@/components/storefront/StoreChrome";
import CheckoutClient from "@/app/checkout/CheckoutClient";
import { getProfile } from "@/lib/profile";
import { onlinePaymentAvailable } from "@/lib/order-actions";
import { getSavedGstins, getSavedPhones, PHONE_SOURCE_LABEL } from "@/lib/saved-fields";
import { savedEntries } from "@/lib/checkout-prefill";
import { getCustomOrder, isPayable, customOrderTotals } from "@/lib/custom-orders";
import { fmt } from "@/lib/format";

/**
 * /order/<token>: an order prepared by Elume for a specific customer
 * (custom_orders, migration 0131). The page IS the normal checkout with the
 * cart replaced by the prepared lines: signed-in and repeat buyers get their
 * saved addresses, GSTINs and phones exactly as on /checkout; guests fill the
 * form; everyone pays through Razorpay. The token is single-use.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Complete your order", robots: { index: false, follow: false } };

function Notice({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 560, margin: "0 auto", padding: "64px 28px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>{title}</h1>
        <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.65, margin: "0 0 18px" }}>{body}</p>
        {cta && <Link href={cta.href} style={{ display: "inline-block", background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: 10 }}>{cta.label}</Link>}
        <p style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 22 }}>Questions? info@elumenuvo.com · +91 98188 21175</p>
      </main>
    </StoreChrome>
  );
}

export default async function CustomOrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const co = await getCustomOrder(token);
  if (!co) return <Notice title="We couldn't find that order" body="The link may be incomplete. Please open it again from the message we sent you, or ask us for a fresh link." cta={{ href: "/", label: "Go to elumenuvo.com" }} />;
  if (co.status === "converted") return <Notice title="This order is already placed" body={`Order ${co.converted_order_id ?? ""} has been paid and is being processed. You can track it any time.`} cta={{ href: `/track?order=${encodeURIComponent(co.converted_order_id ?? "")}`, label: "Track my order" }} />;
  if (!isPayable(co)) return <Notice title="This order link has expired" body="Prices on a prepared order are held for a limited time. Ask us and we will send you a fresh link with current pricing." cta={{ href: "/bulk-enquiry", label: "Contact us" }} />;

  const [profile, onlineEnabled] = await Promise.all([getProfile(), onlinePaymentAvailable()]);
  const email = profile?.email ?? "";
  const [saved, gstins, phones] = await Promise.all([
    email ? savedEntries(email) : Promise.resolve([]),
    email ? getSavedGstins(email) : Promise.resolve([]),
    email ? getSavedPhones(email) : Promise.resolve([]),
  ]);
  const c = co.customer ?? {};
  const { goodsPayable } = customOrderTotals(co);

  return (
    <StoreChrome>
      <div style={{ maxWidth: 1120, margin: "18px auto 0", padding: "0 28px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "#1D2F8A" }}>Prepared order</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "4px 0 2px" }}>{c.name ? `${c.name}, your order is ready to complete` : "Your order is ready to complete"}</h1>
        <p style={{ fontSize: 13, color: "#56627A", margin: 0 }}>{co.items.length} line{co.items.length === 1 ? "" : "s"} · {fmt(goodsPayable)} for goods incl. GST{co.shipping_fee != null ? ` · delivery ${co.shipping_fee > 0 ? fmt(co.shipping_fee) : "free"}` : ""} · link valid until {new Date(co.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}</p>
      </div>
      <CheckoutClient
        onlineEnabled={onlineEnabled}
        saved={saved}
        savedGstins={gstins.map((g) => ({ id: g.id, value: g.gstin, label: g.label || g.state }))}
        savedPhones={phones.map((p) => ({ id: p.id, value: p.phone, label: p.label || PHONE_SOURCE_LABEL[p.source] || "" }))}
        prefill={{
          // The admin's details for the customer lead; a signed-in profile
          // fills anything left blank.
          name: c.name || profile?.full_name || "",
          email: c.email || profile?.email || "",
          phone: c.phone || profile?.phone || "",
          gstin: c.gstin || profile?.gstin || "",
          company: profile?.company ?? "",
          isBusiness: profile?.account_type === "business",
          signedIn: !!profile,
        }}
        custom={{
          token: co.token,
          items: co.items.map((i) => ({ id: i.id, name: i.name, brand: "", price: Number(i.price), mrp: Number(i.listPrice ?? i.price), unit: i.unit || "pc", cat: i.cat, gstRate: i.gstRate, qty: Number(i.qty), shipWeightKg: i.shipWeightKg })),
          shippingFee: co.shipping_fee == null ? null : Number(co.shipping_fee),
          discountAmount: Number(co.discount_amount || 0),
          note: co.note,
        }}
      />
    </StoreChrome>
  );
}
