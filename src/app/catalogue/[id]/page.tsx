import { notFound } from "next/navigation";
import { PRODUCTS } from "@/lib/data";
import PublicProductView from "@/components/storefront/PublicProductView";

// Pre-render a detail page for every catalogue product.
export function generateStaticParams() {
  return PRODUCTS.map((p) => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) notFound();
  return <PublicProductView p={product} />;
}
