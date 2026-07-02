"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetail from "@/components/app/ProductDetail";
import VariantPicker from "@/components/storefront/VariantPicker";
import Stars from "@/components/storefront/Stars";
import type { Product } from "@/lib/data";

/** Public wrapper around the shared dashboard ProductDetail (browse-only),
 *  with storefront extras: star summary + variant picker. */
export default function PublicProductView({ p, siblings = [] }: { p: Product; siblings?: Product[] }) {
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
        p.rating && p.ratingCount ? <Stars rating={p.rating} count={p.ratingCount} /> : undefined
      }
      variantSlot={<VariantPicker p={p} siblings={siblings} />}
    />
  );
}
