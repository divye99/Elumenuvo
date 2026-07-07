import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listOrders, hasServiceRole } from "@/lib/admin/data";
import { fmt } from "@/lib/format";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";

export const dynamic = "force-dynamic";

const OPEN = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery"];

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const { filter } = await searchParams;
  const all = await listOrders();
  const view = filter === "open" ? all.filter((o) => OPEN.includes(o.status)) : filter === "done" ? all.filter((o) => !OPEN.includes(o.status)) : all;
  const openCount = all.filter((o) => OPEN.includes(o.status)).length;

  const tab = (key: string, label: string, count: number) => {
    const active = (filter ?? "all") === key;
    return (
      <Link href={`/admin/orders${key === "all" ? "" : `?filter=${key}`}`} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: active ? "#161D2B" : "#fff", color: active ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {tab("all", "All", all.length)}
        {tab("open", "To fulfil", openCount)}
        {tab("done", "Completed", all.length - openCount)}
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
          {view.map((o, i) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 90px 110px 150px", gap: 12, padding: "13px 16px", alignItems: "center", borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              <span style={{ fontFamily: "var(--space-mono)", fontSize: 12.5, fontWeight: 600, color: "#19202E" }}>{o.id}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name || "—"}</span>
                <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{(o.items ?? []).reduce((s, it) => s + it.qty, 0)} item{(o.items ?? []).length === 1 ? "" : "s"}{o.gstin ? " · GST" : ""}{o.is_guest ? " · guest" : ""}</span>
              </span>
              <span style={{ textAlign: "right", fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 14 }}>{o.total != null ? fmt(o.total) : "—"}</span>
              <span style={{ fontSize: 12, color: "#56627A" }}>{new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
              <span><OrderStatusBadge status={o.status} /></span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
