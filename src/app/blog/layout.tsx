import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--hanken)", background: "#fff", minHeight: "100vh", color: "#19202e" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid #EEF0F4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", height: 64, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark height={28} />
            <Wordmark height={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <Link href="/catalogue" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>Catalogue</Link>
            <Link href="/blog" style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>Blog</Link>
            <Link href="/space" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>Space</Link>
            <Link href="/signin" style={{ fontSize: 14, fontWeight: 600, color: "#fff", background: "#4E5BDC", padding: "9px 18px", borderRadius: 10 }}>Sign in</Link>
          </div>
        </div>
      </header>
      {children}
      <footer style={{ borderTop: "1px solid #EEF0F4", background: "#F7F8FB" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 24px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, fontSize: 13, color: "#8A93A6" }}>
          <span>© {new Date().getFullYear()} Elume Nuvotech Private Limited · Procurement for FMEG.</span>
          <Link href="/catalogue" style={{ color: "#4E5BDC", fontWeight: 600 }}>Browse the catalogue →</Link>
        </div>
      </footer>
    </div>
  );
}
