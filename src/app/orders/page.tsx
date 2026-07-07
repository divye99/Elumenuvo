import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import StoreChrome from "@/components/storefront/StoreChrome";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { fmt } from "@/lib/format";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import type { OrderRow } from "@/lib/admin/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My orders", robots: { index: false } };

/** A signed-in customer's own orders (matched on user_id). Read server-side via
 *  the service role — the orders table has no anon policy. */
async function myOrders(userId: string): Promise<OrderRow[]> {
  const db = adminClient();
  if (!db) return [];
  const { data } = await db.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  return (data ?? []) as OrderRow[];
}

export default async function MyOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/orders");
  const orders = await myOrders(user.id);

  return (
    <StoreChrome>
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "36px 24px 60px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <h1 style={{ fontFamily: "var(--space-grotesk)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", margin: 0 }}>My orders</h1>
          <Link href="/catalogue" style={{ fontSize: 13, color: "#4E5BDC", fontWeight: 600 }}>Browse catalogue →</Link>
        </div>
        <p style={{ fontSize: 13.5, color: "#8A93A6", margin: "0 0 20px" }}>Orders placed while signed in as {user.email}.</p>

        {orders.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}>📦</div>
            <div style={{ fontFamily: "var(--space-grotesk)", fontSize: 18, fontWeight: 600 }}>No orders yet</div>
            <p style={{ fontSize: 13.5, color: "#8A93A6", margin: "8px 0 16px" }}>Placed an order as a guest? Track it with your order number and email.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link href="/catalogue" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: 10 }}>Start shopping</Link>
              <Link href="/track" style={{ background: "#EEF0FE", color: "#4E5BDC", fontWeight: 700, fontSize: 14, padding: "10px 20px", borderRadius: 10 }}>Track a guest order</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orders.map((o) => (
              <Link key={o.id} href={`/track?order=${encodeURIComponent(o.id)}&email=${encodeURIComponent(o.email)}`} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px", display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--space-mono)", fontSize: 13.5, fontWeight: 700 }}>{o.id}</span>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 15 }}>{o.total != null ? fmt(o.total) : "—"}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "#8A93A6" }}>
                  {new Date(o.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" } as Intl.DateTimeFormatOptions)} · {(o.items ?? []).reduce((s, it) => s + it.qty, 0)} item{(o.items ?? []).length === 1 ? "" : "s"} · {(o.items ?? []).slice(0, 2).map((it) => it.name).join(", ")}{(o.items ?? []).length > 2 ? "…" : ""}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </StoreChrome>
  );
}
