import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders, hasServiceRole } from "@/lib/admin/data";
import { fmt } from "@/lib/format";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";

export const dynamic = "force-dynamic";

const OPEN = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery"];
// Checkout attempts where money never captured. Kept OUT of the paid tabs,
// but surfaced in their own "Abandoned" view — a fully-filled checkout is
// the hottest recovery lead a store has (name, phone, items, address).
const UNPAID = ["awaiting_payment", "payment_abandoned"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ filter?: string; email?: string }> }) {
  await requireAdmin();
  const { filter, email } = await searchParams;
  // Optional per-customer view (linked from the order detail page).
  const emailFilter = (email ?? "").trim().toLowerCase();
  const unfiltered = await listOrders();
  const everything = emailFilter ? unfiltered.filter((o) => (o.email ?? "").toLowerCase() === emailFilter) : unfiltered;
  const all = everything.filter((o) => !UNPAID.includes(o.status));
  const abandoned = everything.filter((o) => UNPAID.includes(o.status));
  const view =
    filter === "open" ? all.filter((o) => OPEN.includes(o.status))
    : filter === "done" ? all.filter((o) => !OPEN.includes(o.status))
    : filter === "abandoned" ? abandoned
    : all;
  const openCount = all.filter((o) => OPEN.includes(o.status)).length;
  const showingAbandoned = filter === "abandoned";

  const tab = (key: string, label: string, count: number) => {
    const active = (filter ?? "all") === key;
    const q = new URLSearchParams();
    if (key !== "all") q.set("filter", key);
    if (emailFilter) q.set("email", emailFilter);
    const qs = q.toString();
    return (
      <Link href={`/admin/orders${qs ? `?${qs}` : ""}`} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: active ? "#161D2B" : "#fff", color: active ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
        {label} <span style={{ opacity: 0.7 }}>{count}</span>
      </Link>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Orders</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>Incoming orders and fulfilment. Click an order to pack, ship and track it.</p>

      {!hasServiceRole() && (
        <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 18 }}>
          <b>Read-only.</b> Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to load and fulfil orders.
        </div>
      )}

      {emailFilter && (
        <div style={{ background: "#EFFAF4", border: "1px solid #BFE8D2", color: "#166B44", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <span>Showing every order from <b>{emailFilter}</b></span>
          <Link href={`/admin/orders${filter && filter !== "all" ? `?filter=${filter}` : ""}`} style={{ color: "#166B44", fontWeight: 700 }}>Show all customers</Link>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tab("all", "All", all.length)}
        {tab("open", "To fulfil", openCount)}
        {tab("done", "Completed", all.length - openCount)}
        {tab("abandoned", "Abandoned", abandoned.length)}
      </div>

      {view.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No orders {filter === "open" ? "to fulfil" : filter === "done" ? "completed" : "yet"}.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 150px", gap: 12, padding: "11px 16px", fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #F0F2F6" }}>
            <span>Order</span><span>Customer</span><span style={{ textAlign: "right" }}>Total</span><span>Placed</span><span>Status</span>
          </div>
          {view.map((o, i) => showingAbandoned ? (
            <div key={o.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 150px", gap: 12, padding: "13px 16px", alignItems: "center", borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              <Link href={`/admin/orders/${o.id}`} style={{ fontFamily: "var(--space-mono)", fontSize: 12.5, fontWeight: 600, color: "#4E5BDC" }}>{o.id}</Link>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name || "—"}</span>
                <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{o.email ?? "no email"}{o.phone ? ` · ${o.phone}` : ""}</span>
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 14 }}>{o.total != null ? fmt(o.total) : "—"}</span>
              <span style={{ fontSize: 12, color: "#56627A" }}>{new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</span>
              {o.phone ? (
                <a
                  href={`https://wa.me/91${String(o.phone).replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(`Hi ${o.name || "there"}, this is Elume (elumenuvo.com). We noticed your order didn't complete — happy to help you finish it, or answer any questions!`)}`}
                  target="_blank"
                  style={{ fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "5px 10px", borderRadius: 8, textAlign: "center" }}
                >
                  WhatsApp →
                </a>
              ) : (
                <span><OrderStatusBadge status={o.status} /></span>
              )}
            </div>
          ) : (
            <Link key={o.id} href={`/admin/orders/${o.id}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 150px", gap: 12, padding: "13px 16px", alignItems: "center", borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              <span style={{ fontFamily: "var(--space-mono)", fontSize: 12.5, fontWeight: 600, color: "#19202E" }}>{o.id}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name || "—"}</span>
                <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{(o.items ?? []).reduce((s, it) => s + it.qty, 0)} item{(o.items ?? []).length === 1 ? "" : "s"}{o.gstin ? " · GST" : ""}{o.is_guest ? " · guest" : ""}</span>
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 14 }}>{o.total != null ? fmt(o.total) : "—"}</span>
              <span style={{ fontSize: 12, color: "#56627A" }}>{new Date(o.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}</span>
              <span><OrderStatusBadge status={o.status} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
