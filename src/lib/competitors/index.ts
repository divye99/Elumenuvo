/** Competitor adapter registry. Add a site: write an adapter, register it here,
 *  and insert a row in competitor_sources. The admin + sync are source-agnostic. */
import type { CompetitorAdapter } from "./types";
import { vashiAdapter } from "./vashi";
import { cromptonAdapter, legrandAdapter, havellsAdapter } from "./brands";
import { syskaAdapter, iboAdapter, handypandaAdapter } from "./stubs";

export const ADAPTERS: Record<string, CompetitorAdapter> = {
  // Tier 1 — live public price feeds (verified).
  vashi: vashiAdapter, // SAP Commerce OCC (wires, switchgear)
  crompton: cromptonAdapter, // Shopify (fans)
  havells: havellsAdapter, // Magento GraphQL (fans, switches, wires, lighting)
  // Registered but disabled: adapter is correct, discovery needs more work.
  legrand: legrandAdapter, // Magento GraphQL; switch catalogue not in search index
  // Tier 2 — registered stubs; disabled until the endpoint is traced.
  syska: syskaAdapter,
  ibo: iboAdapter,
  handypanda: handypandaAdapter,
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
