import Link from "next/link";
import { getProfile, isBusiness } from "@/lib/profile";
import { isAdmin } from "@/lib/admin/auth";

/** Internal wiki gate: business-account login OR the admin password (owner
 *  spec: either one is enough). Unlisted everywhere: noindex, no sitemap
 *  entry, no nav links anywhere on the site. */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Elume Wiki",
  robots: { index: false, follow: false },
};

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const [profile, admin] = await Promise.all([getProfile(), isAdmin()]);
  const allowed = admin || isBusiness(profile);

  return (
    <div style={{ fontFamily: "var(--hanken)", minHeight: "100vh", background: "#F7F8FB", color: "#19202E" }}>
      <header style={{ background: "#161D2B", color: "#fff" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px", height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/wiki" style={{ fontWeight: 700, letterSpacing: "-0.3px" }}>Elume Wiki <span style={{ fontSize: 11, fontWeight: 800, color: "#9AA6FF", marginLeft: 6 }}>INTERNAL</span></Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>↗ elumenuvo.com</Link>
        </div>
      </header>
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "30px 24px 70px" }}>
        {allowed ? children : (
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "34px 32px", maxWidth: 520, margin: "60px auto" }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 10px" }}>This wiki is internal</h1>
            <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.65, margin: "0 0 20px" }}>
              It documents how Elume's systems work: search, ranking, pricing, logistics. Access needs a business account sign-in or the admin password.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Link href="/signin?next=/wiki" style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", background: "#4E5BDC", borderRadius: 9, padding: "10px 18px" }}>Sign in</Link>
              <Link href="/admin/login" style={{ fontSize: 13.5, fontWeight: 700, color: "#3A4358", background: "#F3F5F9", borderRadius: 9, padding: "10px 18px" }}>Admin login</Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
