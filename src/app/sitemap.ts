import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/products";
import { getSlugs } from "@/lib/blog";

const SITE = "https://elumenuvo.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await fetchProducts();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/catalogue`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/space`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/space/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/space/catalogue`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE}/catalogue/${p.id}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const blogPages: MetadataRoute.Sitemap = getSlugs().map((slug) => ({
    url: `${SITE}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticPages, ...productPages, ...blogPages];
}
