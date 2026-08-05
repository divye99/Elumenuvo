import { requireAdmin } from "@/lib/admin/auth";
import { fetchProductsLite } from "@/lib/products";
import CartLinkBuilder from "@/app/admin/cart-links/CartLinkBuilder";

export const dynamic = "force-dynamic";

/**
 * Admin → Cart links: compose a customer's cart and send it on WhatsApp.
 * The customer opens the link, the items are already in their cart, and all
 * that is left is checkout. Links carry ids + quantities only; price, GST
 * and stock resolve live when opened.
 */
export default async function CartLinksPage() {
  await requireAdmin();
  const products = await fetchProductsLite();
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Cart links</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 720 }}>
        Build a ready-made cart for a customer and send it on WhatsApp. They open the link, the items are
        already in their cart, and they go straight to checkout. Prices and stock are resolved when the
        customer opens the link, so it stays correct even if you reprice later.
      </p>
      <CartLinkBuilder products={products.filter((p) => p.inStock !== false)} />
    </div>
  );
}
