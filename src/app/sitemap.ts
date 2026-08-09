import type { MetadataRoute } from "next";
import { fetchProducts } from "@/lib/products";
import { getSlugs } from "@/lib/blog";
import { listPublicCompareSlugs } from "@/lib/compare/pages";
import { slugify } from "@/lib/slug";

const SITE = "https://elumenuvo.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [products, compareSlugs] = await Promise.all([fetchProducts(), listPublicCompareSlugs()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/compare`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...compareSlugs.map((s) => ({ url: `${SITE}/compare/${s.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    { url: `${SITE}/catalogue`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/metals`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/metals/enquiry`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/credit`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/space`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/space/about`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/space/catalogue`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/returns`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/sell`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/request-product`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Category hub pages (trending/top-rated/best-seller rails) - derived from
  // live products exactly like the routes themselves, so a new category
  // (e.g. Water Heaters, Aug 2026) enters the sitemap on its first deploy.
  const categoryPages: MetadataRoute.Sitemap = [...new Set(products.map((p) => p.cat))].map((cat) => ({
    url: `${SITE}/category/${slugify(cat)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

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

  return [...staticPages, ...categoryPages, ...productPages, ...blogPages];
}
