import StoreChrome from "@/components/storefront/StoreChrome";

/** Metals hub + enquiry pages share the public storefront chrome, so the
 *  Metals family reads as part of the same store as FMEG. */
export default function MetalsLayout({ children }: { children: React.ReactNode }) {
  return <StoreChrome>{children}</StoreChrome>;
}
