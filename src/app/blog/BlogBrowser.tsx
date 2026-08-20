"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GROTESK, MONO } from "@/lib/fonts";

export type BlogCard = {
  slug: string; title: string; description: string;
  category: string; date: string; readMins: number;
};

/**
 * The blog index with its own controls: category chips + a search box that
 * searches ONLY the blog (title, description, category) - separate from the
 * product search in the header. Everything filters client-side over the full
 * post list, so the page stays static and instant.
 */
export default function BlogBrowser({ posts }: { posts: BlogCard[] }) {
  const [cat, setCat] = useState<string>("All");
  const [q, setQ] = useState("");

  const cats = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of posts) seen.set(p.category, (seen.get(p.category) ?? 0) + 1);
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [posts]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return posts.filter((p) => {
      if (cat !== "All" && p.category !== cat) return false;
      if (!needle) return true;
      return `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(needle);
    });
  }, [posts, cat, q]);

  return (
    <>
      {/* Blog-only search */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
          <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, border: "2px solid #b6bdcb", borderRadius: "50%" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the guides… e.g. MCB, house wire, fan"
            aria-label="Search blog guides"
            style={{ width: "100%", border: "1px solid #E0E4ED", borderRadius: 11, padding: "11px 14px 11px 36px", fontSize: 13.5, background: "#fff" }}
          />
          {q && (
            <span onClick={() => setQ("")} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "#8A93A6", fontSize: 16, lineHeight: 1 }}>×</span>
          )}
        </div>
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{shown.length} guide{shown.length === 1 ? "" : "s"}</span>
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        {["All", ...cats].map((c) => {
          const on = cat === c;
          return (
            <span
              key={c}
              onClick={() => setCat(c)}
              style={{ fontSize: 12.5, fontWeight: 700, color: on ? "#fff" : "#3A4358", background: on ? "#1D2F8A" : "#fff", border: `1px solid ${on ? "#1D2F8A" : "#E0E4ED"}`, borderRadius: 20, padding: "7px 14px", cursor: "pointer", userSelect: "none" }}
            >
              {c}
            </span>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "40px 24px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No guides match &quot;{q.trim()}&quot;{cat !== "All" ? ` in ${cat}` : ""}. Try another word or{" "}
          <span onClick={() => { setQ(""); setCat("All"); }} style={{ color: "#1D2F8A", fontWeight: 700, cursor: "pointer" }}>clear the filters</span>.
        </div>
      ) : (
        <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18 }}>
          {shown.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 22, display: "block" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#1D2F8A", background: "#EEF0FD", padding: "4px 10px", borderRadius: 20, marginBottom: 12 }}>{p.category}</div>
              <h2 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, lineHeight: 1.25, margin: "0 0 8px" }}>{p.title}</h2>
              <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.5, margin: 0 }}>{p.description}</p>
              <div style={{ fontFamily: MONO, fontSize: 11.5, color: "#A0A7B5", marginTop: 14 }}>
                {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} · {p.readMins} min read
              </div>
            </Link>
          ))}
        </div>
      )}
      <style>{`@media (max-width: 760px){ .blog-grid { grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}
