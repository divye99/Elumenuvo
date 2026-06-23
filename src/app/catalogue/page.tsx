import CatalogueBrowser from "@/components/storefront/CatalogueBrowser";
import { fetchProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function CataloguePage() {
  const products = await fetchProducts();
  return <CatalogueBrowser products={products} />;
}
