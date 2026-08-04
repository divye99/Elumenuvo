import { jsonLd as toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";
import { getAllPosts } from "@/lib/blog";
import BlogBrowser from "./BlogBrowser";
import { GROTESK } from "@/lib/fonts";

const SITE = "https://elumenuvo.com";

export const metadata: Metadata = {
  title: "Elume Blog - FMEG buying guides & Top 10 product lists (India)",
  description:
    "Buying guides and Top 10 product round-ups for electrical goods in India - wires, switchgear, modular switches, distribution boards, fans and LED lighting.",
  alternates: { canonical: `${SITE}/blog` },
  openGraph: {
    siteName: "Elume",
    images: [{ url: "https://elumenuvo.com/og.png", width: 1200, height: 630, alt: "Elume" }], title: "Elume Blog - FMEG buying guides (India)", description: "Top 10 product guides for wires, switchgear, fans, lighting and more.", url: `${SITE}/blog`, type: "website" },
};

export default function BlogIndex() {
  const posts = getAllPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Elume Blog",
    url: `${SITE}/blog`,
    description: "FMEG buying guides and Top 10 product lists for India.",
    blogPost: posts.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      datePublished: p.date,
      author: { "@type": "Organization", name: p.author },
      url: `${SITE}/blog/${p.slug}`,
    })),
  };

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 64px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLd(jsonLd) }} />
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 36, fontWeight: 600, letterSpacing: "-1px", margin: 0 }}>The Elume Blog</h1>
        <p style={{ fontSize: 16, color: "#56627A", margin: "10px 0 0", maxWidth: 640 }}>
          Buying guides and Top 10 product round-ups for India&apos;s electrical goods - wires, switchgear,
          modular, distribution boards, fans and lighting. Written for contractors, builders and procurement teams.
        </p>
      </div>

      {/* Blog-only search + category filters + the card grid (client-side,
          instant; full list ships in the HTML so SEO is unchanged) */}
      <BlogBrowser
        posts={posts.map((p) => ({
          slug: p.slug, title: p.title, description: p.description,
          category: p.category, date: p.date, readMins: p.readMins,
        }))}
      />
    </main>
  );
}
