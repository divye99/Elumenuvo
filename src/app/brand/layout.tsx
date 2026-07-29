import StoreChrome from "@/components/storefront/StoreChrome";

/** Chrome lives in the layout so the loading skeleton paints inside the
 *  header/footer instead of replacing them. */
export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
