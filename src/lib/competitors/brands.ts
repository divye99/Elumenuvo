/**
 * Brand-site adapter instances — one place listing every DTC/marketplace source
 * and its config. Add a Shopify/Magento brand by adding a line here; add a new
 * platform by writing a factory alongside shopify.ts / magento.ts.
 */
import { makeShopifyAdapter } from "./shopify";
import { makeMagentoAdapter } from "./magento";
import { makeDukaanAdapter } from "./dukaan";

// ── Tier 1 — live (public JSON/GraphQL), verified working ──
export const cromptonAdapter = makeShopifyAdapter({ key: "crompton", name: "Crompton", siteUrl: "https://www.crompton.co.in" });
export const havellsAdapter = makeMagentoAdapter({ key: "havells", name: "Havells", siteUrl: "https://havells.com" });

// Syska — Dukaan storefront (scrapes __DUKAAN_DATA__ on the product page).
export const syskaAdapter = makeDukaanAdapter({ key: "syska", name: "Syska", siteUrl: "https://syska.co.in" });

// Atomberg — Magento GraphQL, same engine as Havells. Verified: search + MRP
// (regular_price) + selling (final_price) all live, e.g. Razon ₹7300/₹4149.
export const atombergAdapter = makeMagentoAdapter({ key: "atomberg", name: "Atomberg", siteUrl: "https://atomberg.com" });

// Legrand — same Magento GraphQL engine, but their storefront's search index
// only covers the UPS/energy range; the switches catalogue (Myrius/Arteor —
// what we actually track) lives inside category pages with no per-product SKU
// or GraphQL entry. The adapter is correct (Havells proves it) and will fetch
// by SKU when one is known, but discovery needs category-HTML scraping — left
// disabled in competitor_sources until that's built.
export const legrandAdapter = makeMagentoAdapter({ key: "legrand", name: "Legrand", siteUrl: "https://shop.legrand.co.in" });
