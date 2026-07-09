import StoreChrome from "@/components/storefront/StoreChrome";
import { GROTESK } from "@/lib/fonts";

export type InfoSection = { h: string; body: React.ReactNode };

/** Shared layout for help/legal content pages (FAQ, returns, privacy, terms). */
export default function InfoPage({
  kicker,
  title,
  intro,
  sections,
  updated,
}: {
  kicker: string;
  title: string;
  intro?: string;
  sections: InfoSection[];
  updated?: string;
}) {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 28px 72px" }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 10 }}>{kicker}</div>
        <h1 style={{ fontFamily: GROTESK, fontSize: 32, fontWeight: 600, letterSpacing: "-0.8px", margin: 0 }}>{title}</h1>
        {intro && <p style={{ fontSize: 14.5, color: "#56627A", lineHeight: 1.65, margin: "14px 0 0" }}>{intro}</p>}
        {updated && <p style={{ fontSize: 12, color: "#A0A7B5", margin: "10px 0 0" }}>Last updated: {updated}</p>}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
          {sections.map((s) => (
            <section key={s.h} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 22px" }}>
              <h2 style={{ fontFamily: GROTESK, fontSize: 16.5, fontWeight: 600, margin: "0 0 8px" }}>{s.h}</h2>
              <div style={{ fontSize: 13.5, color: "#3A4358", lineHeight: 1.7 }}>{s.body}</div>
            </section>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 26 }}>
          Questions? Write to <a href="mailto:info@elumenuvo.com" style={{ color: "#4E5BDC", fontWeight: 600 }}>info@elumenuvo.com</a> or call{" "}
          <a href="tel:+919818821175" style={{ color: "#4E5BDC", fontWeight: 600 }}>+91 98188 21175</a>.
        </p>
      </main>
    </StoreChrome>
  );
}
