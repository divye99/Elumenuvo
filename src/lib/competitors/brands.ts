/**
 * Brand-site adapter instances - one place listing every DTC/marketplace source
 * and its config. Add a Shopify/Magento brand by adding a line here; add a new
 * platform by writing a factory alongside shopify.ts / magento.ts.
 */
import { makeShopifyAdapter } from "./shopify";
import { makeMagentoAdapter } from "./magento";
import { makeDukaanAdapter } from "./dukaan";

// ── Tier 1 - live (public JSON/GraphQL), verified working ──
export const cromptonAdapter = makeShopifyAdapter({ key: "crompton", name: "Crompton", siteUrl: "https://www.crompton.co.in" });
export const havellsAdapter = makeMagentoAdapter({ key: "havells", name: "Havells", siteUrl: "https://havells.com" });
// ABB eMart - Magento behind a WAF that requires POSTed JSON, and a schema
// with no sku filter: all lookups go through search (see makeMagentoAdapter).
export const abbAdapter = makeMagentoAdapter({ key: "abb", name: "ABB eMart", siteUrl: "https://shop.in.abb.com", post: true, searchOnly: true });

// Syska - Dukaan storefront (scrapes __DUKAAN_DATA__ on the product page).
export const syskaAdapter = makeDukaanAdapter({ key: "syska", name: "Syska", siteUrl: "https://syska.co.in" });

// Orient - Shopify DTC store (orientelectric.com). Verified: search suggest +
// per-variant sku/EAN + compare_at_price (MRP) all live, e.g. Aeroquiet ₹8221/₹9350.
export const orientAdapter = makeShopifyAdapter({ key: "orient", name: "Orient", siteUrl: "https://orientelectric.com" });

// Atomberg - Magento GraphQL, same engine as Havells. Verified: search + MRP
// (regular_price) + selling (final_price) all live, e.g. Razon ₹7300/₹4149.
export const atombergAdapter = makeMagentoAdapter({ key: "atomberg", name: "Atomberg", siteUrl: "https://atomberg.com" });

// Legrand - their Magento GraphQL hides the catalogue (sku filters and search
// return nothing useful), so this adapter scrapes the product page itself.
// competitor_code = "slug#SKU"; the on-page SKU is verified on every fetch.
// Seeded from a full crawl of shop.legrand.co.in (874 pages, 861 SKUs).
export { legrandShopAdapter as legrandAdapter } from "./legrandshop";
