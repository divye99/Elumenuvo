import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listProductRows, listContentRows, hasServiceRole, countPendingSuggestions } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const [products, content, pending] = await Promise.all([listProductRows(), listContentRows(), countPendingSuggestions()]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 22px" }}>Manage the catalogue and site content — changes go live on the next page load.</p>

      {!hasServiceRole() && (
        <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 20 }}>
          <b>Writes are disabled.</b> Set <code>SUPABASE_SERVICE_ROLE_KEY</code> (and <code>ADMIN_PASSWORD</code>) in your env to enable editing. You can still view below.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <Link href="/admin/products" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Catalogue</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{products.length}</div>
          <div style={{ fontSize: 13, color: "#4E5BDC", fontWeight: 600, marginTop: 6 }}>Manage products & pricing →</div>
        </Link>
        <Link href="/admin/radar" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, position: "relative" }}>
          {pending > 0 && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 12, fontWeight: 700, color: "#fff", background: "#E0612A", borderRadius: 20, padding: "2px 9px" }}>{pending}</span>}
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Price radar · Vashi</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pending}</div>
          <div style={{ fontSize: 13, color: "#4E5BDC", fontWeight: 600, marginTop: 6 }}>{pending > 0 ? "Review price suggestions →" : "Competitor tracking →"}</div>
        </Link>
        <Link href="/admin/content" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Content blocks</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{content.length}</div>
          <div style={{ fontSize: 13, color: "#4E5BDC", fontWeight: 600, marginTop: 6 }}>Edit site content →</div>
        </Link>
      </div>
    </div>
  );
}
