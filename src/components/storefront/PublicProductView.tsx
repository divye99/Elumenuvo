"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetail from "@/components/app/ProductDetail";
import VariantPicker from "@/components/storefront/VariantPicker";
import Rating from "@/components/storefront/Rating";
import { useCart } from "@/lib/cart";
import type { Product } from "@/lib/data";

/** Public wrapper around the shared dashboard ProductDetail (browse-only),
 *  with storefront extras: star summary, variant picker, cart / buy-now. */
export default function PublicProductView({ p, siblings = [], business = false }: { p: Product; siblings?: Product[]; business?: boolean }) {
  const router = useRouter();
  const cart = useCart();
  const [qty, setQty] = useState(1);

  const toCart = () => cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, image: p.image }, qty);

  return (
    <ProductDetail
      p={p}
      qty={qty}
      setQty={setQty}
      variant="public"
      onCatalogue={() => router.push("/catalogue")}
      onAddToCart={() => { toCart(); router.push("/cart"); }}
      onBuyNow={() => { toCart(); router.push("/checkout"); }}
      ratingSummary={p.rating && p.ratingCount ? <Rating rating={p.rating} count={p.ratingCount} /> : undefined}
      variantSlot={<VariantPicker p={p} siblings={siblings} />}
      showGst={business}
    />
  );
}
