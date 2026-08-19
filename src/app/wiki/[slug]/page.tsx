import Link from "next/link";
import { notFound } from "next/navigation";
import { WIKI, getWikiArticle } from "@/lib/wiki";

/** Renders the tiny markdown used in wiki bodies: "## " headings, "- "
 *  bullets, blank-line paragraphs. Nothing more on purpose. */
function renderBody(body: string) {
  const blocks = body.split(/\n\n+/);
  return blocks.map((block, i) => {
    const lines = block.split("\n");
    if (lines[0].startsWith("## ")) {
      const rest = lines.slice(1).join("\n");
      return (
        <div key={i}>
          <h2 style={{ fontSize: 15.5, fontWeight: 700, margin: "22px 0 8px" }}>{lines[0].slice(3)}</h2>
          {rest && renderBody(rest)}
        </div>
      );
    }
    if (lines.every((l) => l.startsWith("- "))) {
      return (
        <ul key={i} style={{ margin: "10px 0", paddingLeft: 22, display: "grid", gap: 6 }}>
          {lines.map((l, j) => <li key={j} style={{ fontSize: 14, lineHeight: 1.65, color: "#2A3345" }}>{l.slice(2)}</li>)}
        </ul>
      );
    }
    return <p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "#2A3345", margin: "10px 0" }}>{block}</p>;
  });
}

export default async function WikiArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getWikiArticle(slug);
  if (!article) notFound();

  const idx = WIKI.findIndex((a) => a.slug === slug);
  const next = WIKI[(idx + 1) % WIKI.length];

  return (
    <article>
      <Link href="/wiki" style={{ fontSize: 13, color: "#4E5BDC", fontWeight: 700 }}>← All articles</Link>
      <h1 style={{ fontSize: 23, fontWeight: 700, margin: "12px 0 4px" }}>{article.title}</h1>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 6px" }}>{article.summary}</p>
      <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 18 }}>{article.tags.join(" · ")}</div>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 26px" }}>
        {renderBody(article.body)}
      </div>
      <div style={{ marginTop: 18, fontSize: 13.5 }}>
        Next: <Link href={`/wiki/${next.slug}`} style={{ color: "#4E5BDC", fontWeight: 700 }}>{next.title}</Link>
      </div>
    </article>
  );
}
