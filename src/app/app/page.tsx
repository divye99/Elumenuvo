import { Suspense } from "react";
import AppShell from "@/components/app/AppShell";
import { fetchProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

// The buyer app (portfolio, catalogue, product, project, Smart BOM, cart, tracking).
export default async function Page() {
  const products = await fetchProducts();
  return (
    <Suspense fallback={null}>
      <AppShell products={products} />
    </Suspense>
  );
}
