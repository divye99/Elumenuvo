import Link from "next/link";
import RefreshCatalogueButton from "@/components/admin/RefreshCatalogueButton";
import { requireAdmin } from "@/lib/admin/auth";
import { countProducts, listContentRows, hasServiceRole, countPendingSuggestions, countOpenOrders, countInFlightShipments } from "@/lib/admin/data";
import { countPendingReviews } from "@/lib/admin/review-actions";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  await requireAdmin();
  const [productCount, content, pending, openOrders, pendingReviews, inFlight] = await Promise.all([countProducts(), listContentRows(), countPendingSuggestions(), countOpenOrders(), countPendingReviews(), countInFlightShipments()]);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Dashboard</h1>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 22px" }}>Manage the catalogue and site content - changes go live on the next page load.</p>

      {!hasServiceRole() && (
        <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 20 }}>
          <b>Writes are disabled.</b> Set <code>SUPABASE_SERVICE_ROLE_KEY</code> (and <code>ADMIN_PASSWORD</code>) in your env to enable editing. You can still view below.
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <RefreshCatalogueButton />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Link href="/admin/orders" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, position: "relative" }}>
          {openOrders > 0 && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 12, fontWeight: 700, color: "#fff", background: "#F25929", borderRadius: 20, padding: "2px 9px" }}>{openOrders}</span>}
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Orders</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{openOrders}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>{openOrders > 0 ? "Fulfil open orders →" : "View orders →"}</div>
        </Link>
        <Link href="/admin/products" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Catalogue</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{productCount}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Manage products & pricing →</div>
        </Link>
        <Link href="/admin/logistics" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, position: "relative" }}>
          {inFlight > 0 && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 12, fontWeight: 700, color: "#fff", background: "#1D2F8A", borderRadius: 20, padding: "2px 9px" }}>{inFlight}</span>}
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Logistics</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{inFlight}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>{inFlight > 0 ? "Parcels in transit - courier scorecard →" : "Courier scorecard & freight costs →"}</div>
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Link href="/admin/radar" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, position: "relative" }}>
          {pending > 0 && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 12, fontWeight: 700, color: "#fff", background: "#F25929", borderRadius: 20, padding: "2px 9px" }}>{pending}</span>}
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Price radar · Vashi</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pending}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>{pending > 0 ? "Review price suggestions →" : "Competitor tracking →"}</div>
        </Link>
        <Link href="/admin/content" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Content blocks</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{content.length}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Edit site content →</div>
        </Link>
        <Link href="/admin/reviews" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, position: "relative" }}>
          {pendingReviews > 0 && <span style={{ position: "absolute", top: 14, right: 14, fontSize: 12, fontWeight: 700, color: "#fff", background: "#F25929", borderRadius: 20, padding: "2px 9px" }}>{pendingReviews}</span>}
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Reviews</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{pendingReviews > 0 ? pendingReviews : "⚡"}</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>{pendingReviews > 0 ? "Approve pending reviews →" : "Moderation queue →"}</div>
        </Link>
        <Link href="/admin/customers" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Customers</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>🤝</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Portfolios · predicted reorders →</div>
        </Link>
        <Link href="/admin/compare" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Compare mappings</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>⇄</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Like-to-like groups · reject bad pairs →</div>
        </Link>
        <Link href="/admin/cart-links" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Cart links</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>🛒</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Prefilled WhatsApp carts →</div>
        </Link>
        <Link href="/admin/metals" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Metals</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>🥉</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Copper price console · enquiries →</div>
        </Link>
        <Link href="/admin/signups" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Signups</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>👥</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Registered accounts →</div>
        </Link>
        <Link href="/admin/leads" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Leads</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>→</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Waitlist · business · sellers →</div>
        </Link>
        <Link href="/admin/analytics" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Analytics</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>👁</div>
          <div style={{ fontSize: 13, color: "#1D2F8A", fontWeight: 600, marginTop: 6 }}>Visitor journeys · export →</div>
        </Link>
      </div>
    </div>
  );
}
