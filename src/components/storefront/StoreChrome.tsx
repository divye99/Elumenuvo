import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";
import HeaderSearch from "@/components/storefront/HeaderSearch";

/**
 * Shared public-store chrome (Amazon-style): sticky header with search + footer.
 * Used by the home page and the catalogue/product pages so the whole public
 * shopping surface feels like one store.
 */
export default function StoreChrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--hanken)", background: "#F7F8FB", minHeight: "100vh", color: "#19202e" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #EEF0F4",
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin: "0 auto",
            height: 66,
            padding: "0 28px",
            display: "flex",
            alignItems: "center",
            gap: 26,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <Mark height={28} />
            <Wordmark height={16} />
          </Link>

          <HeaderSearch />

          <nav style={{ display: "flex", alignItems: "center", gap: 22, flexShrink: 0, marginLeft: "auto" }}>
            <Link href="/catalogue" style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>
              Catalogue
            </Link>
            <Link href="/blog" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>
              Blog
            </Link>
            <Link href="/business" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>
              For business
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
              Workspace
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer style={{ borderTop: "1px solid #EEF0F4", background: "#fff" }}>
        <div
          style={{
            maxWidth: 1280,
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
          <span style={{ display: "flex", gap: 18 }}>
            <Link href="/space" style={{ color: "#56627A" }}>
              Space procurement
            </Link>
            <Link href="/signin" style={{ color: "#4E5BDC", fontWeight: 600 }}>
              Sign in
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
