import type { Metadata } from "next";
import Link from "next/link";
import StoreChrome from "@/components/storefront/StoreChrome";
import { GROTESK } from "@/lib/fonts";
import { fetchProductsLite } from "@/lib/products";
import { glanceViews30d } from "@/lib/glance";
import { rankProducts, diversify } from "@/lib/ranking";
import { WHOLESALE_MIN_QTY, WHOLESALE_DISCOUNT, wholesalePrice } from "@/lib/pricing";
import ProductCard from "@/components/storefront/ProductCard";
import { fmt } from "@/lib/format";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Buy more, save more - wholesale pricing",
  description:
    "Elume's wholesale policy: order 15 or more units of any product and the price drops 5% automatically. No account, no negotiation, no minimum order value.",
  alternates: { canonical: "https://elumenuvo.com/wholesale" },
};

/**
 * "Buy more, save more" landing page: the wholesale policy stated plainly up
 * top, then the products where bulk buying saves the most actual rupees -
 * ranked by per-order wholesale saving, spread across brands, OOS excluded.
 */
export default async function WholesalePage() {
  const [products, gv] = await Promise.all([fetchProductsLite(), glanceViews30d()]);
  const buyable = products.filter((p) => p.inStock !== false);

  // Biggest rupee saving on a minimum wholesale order (15 units), demand-aware.
  const savings = (p: (typeof buyable)[number]) => (p.price - wholesalePrice(p.price)) * WHOLESALE_MIN_QTY;
  const ranked = diversify(
    rankProducts(buyable, { glanceViews: gv }).sort((a, b) => savings(b) - savings(a)),
    24, 4
  ).slice(0, 24);

  const pct = Math.round(WHOLESALE_DISCOUNT * 100);
  const example = ranked[0];

  return (
    <StoreChrome>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 64px" }}>
        {/* ── Policy header ── */}
        <section style={{ background: "linear-gradient(120deg,#161D2B,#232C44)", color: "#fff", borderRadius: 18, padding: "38px 34px", margin: "22px 0 26px" }}>
          <h1 style={{ fontFamily: GROTESK, fontSize: 30, fontWeight: 700, margin: "0 0 10px" }}>Buy more, save more</h1>
          <p style={{ fontSize: 15, color: "#C6CDE2", margin: "0 0 20px", maxWidth: 760, lineHeight: 1.65 }}>
            Our wholesale policy is one sentence long: order <b style={{ color: "#fff" }}>{WHOLESALE_MIN_QTY} or more units</b> of
            any product and the per-unit price drops <b style={{ color: "#fff" }}>{pct}%</b>, automatically, in the cart.
            No trade account, no negotiation call, no minimum order value - an electrician buying {WHOLESALE_MIN_QTY} switches
            gets the same rate as a contractor buying 500.
          </p>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap", fontSize: 13.5 }}>
            <div><span style={{ color: "#9DB0FF", fontWeight: 700 }}>Applies per product</span><br /><span style={{ color: "#C6CDE2" }}>{WHOLESALE_MIN_QTY}+ of the same item, any colour mix within a wire family</span></div>
            <div><span style={{ color: "#9DB0FF", fontWeight: 700 }}>Stacks with GST invoice</span><br /><span style={{ color: "#C6CDE2" }}>full input credit for business buyers</span></div>
            <div><span style={{ color: "#9DB0FF", fontWeight: 700 }}>Free delivery still applies</span><br /><span style={{ color: "#C6CDE2" }}>pan-India, whatever the order size</span></div>
          </div>
          {example && (
            <p style={{ fontSize: 13, color: "#8FA0C9", margin: "18px 0 0" }}>
              Example: {example.name} at {fmt(example.price)} becomes {fmt(wholesalePrice(example.price))}/unit on {WHOLESALE_MIN_QTY}+
              &nbsp;- that is {fmt(savings(example))} saved on a single minimum wholesale order.
            </p>
          )}
        </section>

        {/* ── Where bulk saves the most ── */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 700, margin: 0 }}>Where bulk saves the most</h2>
          <span style={{ fontSize: 12.5, color: "#8A93A6" }}>ranked by rupees saved on a {WHOLESALE_MIN_QTY}-unit order</span>
          <Link href="/catalogue" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#4E5BDC" }}>Browse everything →</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(224px, 1fr))", gap: 14 }}>
          {ranked.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>

        <p style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 26, maxWidth: 720 }}>
          Need more than the catalogue shows, project-quantity pricing, or 30-day credit terms?
          See <Link href="/business" style={{ color: "#4E5BDC", fontWeight: 600 }}>Elume for business</Link> or
          write to us - bulk enquiries are answered the same day.
        </p>
      </main>
    </StoreChrome>
  );
}
