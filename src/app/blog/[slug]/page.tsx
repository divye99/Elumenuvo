import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost, getSlugs } from "@/lib/blog";
import { GROTESK, MONO } from "@/lib/fonts";

const SITE = "https://elumenuvo.com";

export function generateStaticParams() {
  return getSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  const url = `${SITE}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.description, url, type: "article", publishedTime: post.date, authors: [post.author] },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const url = `${SITE}/blog/${post.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.date,
      author: { "@type": "Organization", name: post.author, url: SITE },
      publisher: { "@type": "Organization", name: "Elume", logo: { "@type": "ImageObject", url: `${SITE}/assets/elume-mark.png` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      articleSection: post.category,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: post.title,
      itemListElement: post.items.map((it) => ({
        "@type": "ListItem",
        position: it.rank,
        name: `${it.brand} ${it.name}`,
      })),
    },
  ];

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 70px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav style={{ fontSize: 13, color: "#8A93A6", marginBottom: 18 }}>
        <Link href="/blog" style={{ color: "#8A93A6" }}>Blog</Link> &nbsp;/&nbsp; <span style={{ color: "#56627A" }}>{post.category}</span>
      </nav>

      <article>
        <div style={{ display: "inline-flex", fontSize: 11, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#4E5BDC", background: "#EEF0FD", padding: "4px 10px", borderRadius: 20, marginBottom: 14 }}>{post.category}</div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-1px", lineHeight: 1.12, margin: "0 0 12px" }}>{post.title}</h1>
        <div style={{ fontFamily: MONO, fontSize: 12, color: "#A0A7B5", marginBottom: 24 }}>
          By {post.author} · {new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {post.readMins} min read
        </div>

        {post.intro.map((para, i) => (
          <p key={i} style={{ fontSize: 16.5, lineHeight: 1.7, color: "#2c3550", margin: "0 0 16px" }}>{para}</p>
        ))}

        {/* Ranked items */}
        <div style={{ marginTop: 14 }}>
          {post.items.map((it) => (
            <div key={it.rank} style={{ borderTop: "1px solid #EEF0F4", padding: "22px 0" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700, color: "#4E5BDC", minWidth: 30 }}>{it.rank}.</span>
                <div>
                  <h2 style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>{it.name}</h2>
                  <div style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 600, marginTop: 2 }}>{it.brand}</div>
                </div>
              </div>
              <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "#2c3550", margin: "12px 0 0" }}>{it.body}</p>
              <div style={{ fontSize: 13, color: "#1F9D63", fontWeight: 600, marginTop: 8 }}>Best for: {it.bestFor}</div>
            </div>
          ))}
        </div>

        {/* Buying tips */}
        {post.buyingTips?.length > 0 && (
          <div style={{ marginTop: 30, background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 14, padding: "22px 24px" }}>
            <h2 style={{ fontFamily: GROTESK, fontSize: 18, fontWeight: 600, margin: "0 0 12px" }}>Buying tips</h2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {post.buyingTips.map((t, i) => (
                <li key={i} style={{ fontSize: 15, lineHeight: 1.6, color: "#2c3550", marginBottom: 8 }}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* FAQ */}
        <div style={{ marginTop: 34 }}>
          <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, margin: "0 0 14px" }}>Frequently asked questions</h2>
          {post.faq.map((f, i) => (
            <div key={i} style={{ borderTop: "1px solid #EEF0F4", padding: "16px 0" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 6px" }}>{f.q}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "#56627A", margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 36, background: "linear-gradient(135deg,#4E5BDC,#1f9d63)", borderRadius: 16, padding: "26px 28px", color: "#fff" }}>
          <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600 }}>Source these on Elume — at transparent prices.</div>
          <p style={{ fontSize: 14.5, opacity: 0.9, margin: "6px 0 16px", maxWidth: 520 }}>
            Compare MRP vs the Elume price across brands, with an extra 5% wholesale rate on 15+ units.
          </p>
          <Link href="/catalogue" style={{ display: "inline-block", background: "#fff", color: "#19202E", fontWeight: 600, fontSize: 14, padding: "11px 22px", borderRadius: 10 }}>Browse the catalogue →</Link>
        </div>
      </article>
    </main>
  );
}
