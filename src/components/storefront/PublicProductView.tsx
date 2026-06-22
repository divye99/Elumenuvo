"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProductDetail from "@/components/app/ProductDetail";
import type { Product } from "@/lib/data";

/** Public wrapper around the shared dashboard ProductDetail (browse-only). */
export default function PublicProductView({ p }: { p: Product }) {
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
    />
  );
}
