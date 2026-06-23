import { notFound } from "next/navigation";
import { fetchProduct } from "@/lib/products";
import PublicProductView from "@/components/storefront/PublicProductView";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await fetchProduct(id);
  if (!product) notFound();
  return <PublicProductView p={product} />;
}
