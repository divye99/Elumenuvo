import Link from "next/link";
import { WIKI } from "@/lib/wiki";

export default function WikiIndex() {
  const tags = [...new Set(WIKI.flatMap((a) => a.tags))];
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>How Elume works</h1>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 24px", maxWidth: 640 }}>
        Brief articles on the logic behind every engine on the platform. Written for new joiners and Key Account Managers; each one is a 3-minute read.
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        {tags.map((tag) => (
          <section key={tag}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#8A93A6", margin: "14px 0 8px" }}>{tag}</div>
            <div style={{ display: "grid", gap: 10 }}>
              {WIKI.filter((a) => a.tags[0] === tag).map((a) => (
                <Link key={a.slug} href={`/wiki/${a.slug}`} style={{ display: "block", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 13, padding: "15px 18px" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#19202E" }}>{a.title}</div>
                  <div style={{ fontSize: 13, color: "#56627A", marginTop: 3 }}>{a.summary}</div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
