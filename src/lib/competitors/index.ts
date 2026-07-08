/** Competitor adapter registry. Add a site: write an adapter, register it here,
 *  and insert a row in competitor_sources. The admin + sync are source-agnostic. */
import type { CompetitorAdapter } from "./types";
import { vashiAdapter } from "./vashi";
import { cromptonAdapter, legrandAdapter, havellsAdapter, syskaAdapter, atombergAdapter } from "./brands";
import { handypandaAdapter } from "./handypanda";
import { bestofelectricalsAdapter } from "./bestofelectricals";
import { iboAdapter } from "./stubs";

export const ADAPTERS: Record<string, CompetitorAdapter> = {
  // Live public price feeds (verified).
  vashi: vashiAdapter, // SAP Commerce OCC (wires, switchgear)
  crompton: cromptonAdapter, // Shopify (fans)
  havells: havellsAdapter, // Magento GraphQL (fans, switches, wires, lighting)
  atomberg: atombergAdapter, // Magento GraphQL (BLDC fans)
  syska: syskaAdapter, // Dukaan storefront scrape (lighting)
  handypanda: handypandaAdapter, // Next.js marketplace scrape (multi-brand electrical)
  bestofelectricals: bestofelectricalsAdapter, // nopCommerce distributor (Norisys, Philips, Wipro, Usha + 10 more brands)
  // Registered but disabled: adapter correct, discovery needs more work.
  legrand: legrandAdapter, // Magento GraphQL; switch catalogue not in search index
  // Disabled stub: needs a live browser trace.
  ibo: iboAdapter, // Cloudflare + client-side pincode API
};

export function getAdapter(source: string): CompetitorAdapter | null {
  return ADAPTERS[source] ?? null;
}

/** Env-provided credentials for a source, if configured (VASHI_USERNAME etc.). */
export function credsFor(source: string): { username: string; password: string } | null {
  const u = (process.env[`${source.toUpperCase()}_USERNAME`] || "").trim();
  const p = (process.env[`${source.toUpperCase()}_PASSWORD`] || "").trim();
  return u && p ? { username: u, password: p } : null;
}

export type { CompetitorAdapter, CompetitorItem } from "./types";
