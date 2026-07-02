import StoreChrome from "@/components/storefront/StoreChrome";

/**
 * Public storefront chrome (Amazon-style) for the open catalogue + product
 * detail pages. Browsing is public; ordering lives in the workspace.
 */
export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
