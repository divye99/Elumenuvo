import type { MetadataRoute } from "next";

const SITE = "https://elumenuvo.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/signin"] },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
