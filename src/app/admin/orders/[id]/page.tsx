import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { getOrderDetail } from "@/lib/admin/data";
import OrderDetailClient from "./OrderDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) {
    return (
      <div>
        <Link href="/admin/orders" style={{ fontSize: 13, color: "#8A93A6" }}>← Orders</Link>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", marginTop: 14 }}>
          Order <b>{id}</b> not found.{" "}
          <span style={{ display: "block", fontSize: 12.5, marginTop: 6 }}>If orders exist in Supabase but not here, set <code>SUPABASE_SERVICE_ROLE_KEY</code>.</span>
        </div>
      </div>
    );
  }
  return <OrderDetailClient order={detail.order} shipments={detail.shipments} events={detail.events} />;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Order ${id} · Elume Admin` };
}
