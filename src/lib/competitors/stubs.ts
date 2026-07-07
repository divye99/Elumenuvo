/**
 * Tier-2 sources — reachable JSON exists but needs one live request traced to
 * pin the endpoint shape. Registered (so they appear in the admin) but return
 * nothing until implemented; the monthly cron skips disabled sources. Each note
 * records exactly what to reverse-engineer so wiring them later is mechanical.
 */
import type { CompetitorAdapter } from "./types";

export function makeStubAdapter(cfg: { key: string; name: string; siteUrl: string; needsLogin?: boolean; note: string }): CompetitorAdapter {
  return {
    key: cfg.key,
    name: cfg.name,
    siteUrl: cfg.siteUrl,
    needsLogin: !!cfg.needsLogin,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async search(_query, _limit) {
      return []; // TODO(cfg.note)
    },
    async fetchByCode() {
      return null; // TODO(cfg.note)
    },
  };
}

// Syska — Dukaan storefront (api.mydukaan.io). Extract store_id from __NEXT_DATA__
// then hit the public products endpoint (api.mydukaan.io/api/…/products/).
export const syskaAdapter = makeStubAdapter({
  key: "syska",
  name: "Syska",
  siteUrl: "https://syska.co.in",
  note: "Dukaan API — find store_id in page __NEXT_DATA__, then api.mydukaan.io storefront products endpoint.",
});

// IBO — Next.js marketplace behind Cloudflare, pricing gated by a post_code
// cookie (like Vashi's pincode). Trace the internal /api call after setting a
// pincode; multi-brand, so matching-to-our-SKUs is the real work, not the fetch.
export const iboAdapter = makeStubAdapter({
  key: "ibo",
  name: "IBO",
  siteUrl: "https://www.ibo.com",
  note: "Next.js + Cloudflare; set post_code cookie, trace the product/price API (pincode-gated).",
});

// HandyPanda — Next.js on Vercel; the JSON product API lives in the client
// bundle, not the initial HTML. Capture the XHR in devtools to get the endpoint.
export const handypandaAdapter = makeStubAdapter({
  key: "handypanda",
  name: "HandyPanda",
  siteUrl: "https://www.handypanda.in",
  note: "Next.js/Vercel; product API called client-side — capture the XHR to get the endpoint shape.",
});
