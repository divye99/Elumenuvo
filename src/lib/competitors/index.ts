/** Competitor adapter registry. Add a site: write an adapter, register it here,
 *  and insert a row in competitor_sources. The admin + sync are source-agnostic. */
import type { CompetitorAdapter } from "./types";
import { vashiAdapter } from "./vashi";

export const ADAPTERS: Record<string, CompetitorAdapter> = {
  vashi: vashiAdapter,
  // amazon: amazonAdapter,   // (next)
  // moglix: moglixAdapter,   // (next)
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
