"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetail from "@/components/app/ProductDetail";
import VariantPicker from "@/components/storefront/VariantPicker";
import Rating from "@/components/storefront/Rating";
import CompetitorPriceChart from "@/components/storefront/CompetitorPriceChart";
import type { Product } from "@/lib/data";
import type { MarketPoint } from "@/lib/competitor-history";

/** Public wrapper around the shared dashboard ProductDetail (browse-only),
 *  with storefront extras: star summary, variant picker, and a compact
 *  price-history bar under the specs. */
export default function PublicProductView({ p, siblings = [], marketHistory = [] }: { p: Product; siblings?: Product[]; marketHistory?: MarketPoint[] }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  return (
    <ProductDetail
      p={p}
      qty={qty}
      setQty={setQty}
      variant="public"
      onCatalogue={() => router.push("/catalogue")}
      onSignIn={() => router.push("/app")}
      ratingSummary={
        p.rating && p.ratingCount ? <Rating rating={p.rating} count={p.ratingCount} /> : undefined
      }
      variantSlot={<VariantPicker p={p} siblings={siblings} />}
      priceHistorySlot={marketHistory.length ? <CompetitorPriceChart series={marketHistory} mrp={p.market} compact /> : undefined}
    />
  );
}
