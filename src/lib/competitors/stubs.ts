/**
 * Registered-but-unbuilt sources. Reachable data exists but needs one live
 * request traced to pin the endpoint; registered so they show in the admin, but
 * return nothing until implemented and stay disabled in competitor_sources.
 */
import type { CompetitorAdapter } from "./types";

export function makeStubAdapter(cfg: { key: string; name: string; siteUrl: string; needsLogin?: boolean; note: string }): CompetitorAdapter {
  return {
    key: cfg.key,
    name: cfg.name,
    siteUrl: cfg.siteUrl,
    needsLogin: !!cfg.needsLogin,
    async search() {
      return []; // TODO(cfg.note)
    },
    async fetchByCode() {
      return null; // TODO(cfg.note)
    },
  };
}

// IBO — Next.js marketplace fully behind Cloudflare: prices load client-side
// from api.ibo.com (pincode-gated via the post_code cookie), and even the JS
// chunks refuse a plain fetch. Cracking it needs a live browser session to
// capture the catalogue/price XHR — curl can't reach it. Left disabled.
export const iboAdapter = makeStubAdapter({
  key: "ibo",
  name: "IBO",
  siteUrl: "https://www.ibo.com",
  note: "Cloudflare + client-side api.ibo.com (post_code cookie). Capture the live catalogue/price XHR in a real browser to get the endpoint.",
});
