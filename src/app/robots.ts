import type { MetadataRoute } from "next";

const SITE = "https://elumenuvo.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // The merchant feed must stay crawlable: Google's scheduled feed fetch
      // respects robots.txt, and a blanket /api/ disallow silently breaks it.
      { userAgent: "*", allow: ["/", "/api/merchant-feed"], disallow: ["/admin", "/api/", "/signin"] },
      // SEO-tool crawlers hammer all 7,600+ pages and send zero customers -
      // on metered edge requests they are pure cost (Vercel blowout, Aug 2026).
      { userAgent: ["AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "DataForSeoBot", "PetalBot", "Bytespider"], disallow: "/" },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
