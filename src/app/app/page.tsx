import { Suspense } from "react";
import AppShell from "@/components/app/AppShell";
import { fetchProducts } from "@/lib/products";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

// The buyer app (portfolio, catalogue, product, project, Smart BOM, cart, tracking).
export default async function Page() {
  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  return (
    <Suspense fallback={null}>
      <AppShell products={products} content={content} />
    </Suspense>
  );
}
