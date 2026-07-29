import StoreChrome from "@/components/storefront/StoreChrome";

/** Collections share the public storefront chrome (header, cart, footer). */
export default function CollectionsLayout({ children }: { children: React.ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
