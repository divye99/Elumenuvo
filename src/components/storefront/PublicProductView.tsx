"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetail from "@/components/app/ProductDetail";
import VariantPicker from "@/components/storefront/VariantPicker";
import Rating from "@/components/storefront/Rating";
import MobileBuyBar from "@/components/storefront/MobileBuyBar";
import { useCart } from "@/lib/cart";
import { WHOLESALE_MIN_QTY } from "@/lib/pricing";
import { isMetalCategory } from "@/lib/metals";
import { track } from "@/lib/analytics";
import type { Product } from "@/lib/data";

/** Public wrapper around the shared dashboard ProductDetail (browse-only),
 *  with storefront extras: star summary, variant picker, cart / buy-now. */
export default function PublicProductView({ p, siblings = [], business = false, abovePrice }: { p: Product; siblings?: Product[]; business?: boolean; abovePrice?: React.ReactNode }) {
  // The page HTML is cached and identical for everyone (so Googlebot can crawl
  // thousands of them cheaply), so the business-account GST view is resolved
  // here, after hydration, rather than on the server.
  const [isBiz, setIsBiz] = useState(business);
  useEffect(() => {
    let live = true;
    fetch("/api/me/account")
      .then((r) => r.json())
      .then((d) => { if (live && d?.business) setIsBiz(true); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  const router = useRouter();
  const cart = useCart();
  const [qty, setQty] = useState(1);

  // Explicit first-party add_to_cart events: the desktop CTA is a styled div,
  // so the generic click listener never sees it - without these the PDP
  // funnel's final step would read zero.
  const toCart = (src = "pdp") => {
    cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image }, qty);
    track("add_to_cart", { detail: { pid: p.id, src, qty } });
  };
  // Adds the qualifying wholesale quantity directly; must NOT read the qty
  // state (a stale closure would add the stepper's count instead of 15).
  const wholesaleToCart = () => {
    cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image }, WHOLESALE_MIN_QTY);
    track("add_to_cart", { detail: { pid: p.id, src: "wholesale", qty: WHOLESALE_MIN_QTY } });
  };

  return (
    <>
      <ProductDetail
        p={p}
        qty={qty}
        setQty={setQty}
        variant="public"
        onCatalogue={() => router.push("/catalogue")}
        onAddToCart={() => { toCart(); router.push("/cart"); }}
        onAddWholesale={() => { wholesaleToCart(); router.push("/cart"); }}
        onBuyNow={() => { toCart("buy-now"); router.push("/checkout"); }}
        ratingSummary={p.rating && p.ratingCount ? <Rating rating={p.rating} count={p.ratingCount} /> : undefined}
        abovePrice={abovePrice}
        variantSlot={<VariantPicker p={p} siblings={siblings} />}
        showGst={isBiz}
      />
      {/* Mobile-only sticky add-to-basket bar (hides on scroll down).
          Metals book via the token flow, never the cart. */}
      {!isMetalCategory(p.cat) && (
        <MobileBuyBar price={p.price} unit={p.unit} cat={p.cat} gstRate={p.gstRate} onAdd={() => toCart("mobile-bar")} />
      )}
    </>
  );
}
