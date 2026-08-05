import type { Metadata } from "next";
import StoreChrome from "@/components/storefront/StoreChrome";
import CartLinkClient from "@/app/cart/link/CartLinkClient";
import { fetchProductsLite } from "@/lib/products";

/**
 * Shared-cart landing: /cart/link?items=<id>:<qty>,<id>:<qty>&src=wa
 *
 * The admin builds these in /admin/cart-links and sends them to customers on
 * WhatsApp. The link carries only ids and quantities; everything else (price,
 * GST, stock) is resolved against the live catalogue when it is opened, so a
 * stale link can never undercharge or sell an out-of-stock item.
 */
export const metadata: Metadata = { title: "Your cart is ready", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CartLinkPage({ searchParams }: { searchParams: Promise<{ items?: string; src?: string }> }) {
  const { items: raw = "", src } = await searchParams;

  const wanted: { id: string; qty: number }[] = [];
  for (const part of raw.split(",").slice(0, 40)) {
    const [id, q] = part.split(":");
    const qty = Math.min(999, Math.max(1, Math.round(Number(q ?? 1)) || 1));
    if (id?.trim()) wanted.push({ id: id.trim(), qty });
  }

  const all = wanted.length ? await fetchProductsLite() : [];
  const byId = new Map(all.map((p) => [p.id, p]));
  const items = wanted
    .map((w) => ({ p: byId.get(w.id), qty: w.qty }))
    .filter((x): x is { p: NonNullable<typeof x.p>; qty: number } => !!x.p && x.p.inStock !== false);
  const missing = wanted.length - items.length;

  return (
    <StoreChrome>
      <CartLinkClient items={items} missing={missing} src={src} />
    </StoreChrome>
  );
}
