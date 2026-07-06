import Link from "next/link";
import { isAdmin } from "@/lib/admin/auth";
import { logout } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();
  return (
    <div style={{ fontFamily: "var(--hanken)", minHeight: "100vh", background: "#F7F8FB", color: "#19202e" }}>
      <header style={{ background: "#161D2B", color: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <Link href="/admin" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>Elume Admin</Link>
            {authed && (
              <nav style={{ display: "flex", gap: 16, fontSize: 14 }}>
                <Link href="/admin/products" style={{ color: "rgba(255,255,255,0.75)" }}>Products</Link>
                <Link href="/admin/radar" style={{ color: "rgba(255,255,255,0.75)" }}>Price radar</Link>
                <Link href="/admin/content" style={{ color: "rgba(255,255,255,0.75)" }}>Content</Link>
              </nav>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>↗ View site</Link>
            {authed && (
              <form action={logout}>
                <button style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", background: "rgba(255,255,255,0.1)", border: "none", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
                  Log out
                </button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 60px" }}>{children}</main>
    </div>
  );
}
