import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CartClient from "@/app/cart/CartClient";

export const metadata: Metadata = { title: "Your cart", robots: { index: false } };

export default function CartPage() {
  return (
    <StoreChrome>
      <CartClient />
    </StoreChrome>
  );
}
