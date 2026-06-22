import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";

/**
 * Public storefront chrome (Amazon-style) for the open catalogue + product
 * detail pages. Browsing is public; ordering lives in the signed-in dashboard.
 */
export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--hanken)", background: "#F7F8FB", minHeight: "100vh", color: "#19202e" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #EEF0F4",
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            height: 66,
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark height={28} />
            <Wordmark height={16} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
            <Link href="/catalogue" style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>
              Catalogue
            </Link>
            <Link href="/space" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>
              Space
            </Link>
            <Link
              href="/app"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#4E5BDC",
                padding: "9px 18px",
                borderRadius: 10,
              }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {children}

      <footer style={{ borderTop: "1px solid #EEF0F4", background: "#fff" }}>
        <div
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "26px 28px",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            fontSize: 13,
            color: "#8A93A6",
          }}
        >
          <span>© {new Date().getFullYear()} Elume Nuvotech Private Limited · Prices indicative, GST extra.</span>
          <Link href="/app" style={{ color: "#4E5BDC", fontWeight: 600 }}>
            Sign in to order →
          </Link>
        </div>
      </footer>
    </div>
  );
}
