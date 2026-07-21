import type { Metadata } from "next";
import Link from "next/link";
import StoreChrome from "@/components/storefront/StoreChrome";
import { adminClient } from "@/lib/supabase/admin";
import { fmt } from "@/lib/format";
import OrderStatusBadge, { STATUS_LABEL } from "@/components/admin/OrderStatusBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

/** Look up an order by id + email (email = the shared secret; no login needed). */
async function lookup(orderId: string, email: string) {
  const db = adminClient();
  if (!db) return null;
  const { data: order } = await db.from("orders").select("*").eq("id", orderId.trim()).maybeSingle();
  if (!order || String(order.email).toLowerCase() !== email.trim().toLowerCase()) return null;
  // An unpaid attempt isn't a trackable order.
  if (order.status === "awaiting_payment" || order.status === "payment_abandoned") return null;
  const [{ data: shipments }, { data: events }] = await Promise.all([
    db.from("order_shipments").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
    db.from("order_events").select("*").eq("order_id", order.id).order("created_at", { ascending: true }),
  ]);
  return { order, shipments: shipments ?? [], events: events ?? [] };
}

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string; email?: string }> }) {
  const { order: orderId, email } = await searchParams;
  const result = orderId && email ? await lookup(orderId, email) : null;

  return (
    <StoreChrome>
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "36px 24px 60px" }}>
        <h1 style={{ fontFamily: "var(--space-grotesk)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", margin: "0 0 6px" }}>Track your order</h1>

        {!result && (
          <>
            <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>Enter your order number and the email you used at checkout.</p>
            {orderId && email && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 13px", fontSize: 13, marginBottom: 16 }}>We couldn&apos;t find an order matching those details.</div>}
            <form method="get" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={lbl}>Order number</label>
                <input name="order" defaultValue={orderId ?? ""} placeholder="ELM-2607-1234" style={inp} required />
              </div>
              <div>
                <label style={lbl}>Email</label>
                <input name="email" type="email" defaultValue={email ?? ""} placeholder="you@email.com" style={inp} required />
              </div>
              <button style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, border: "none", padding: 12, borderRadius: 10, cursor: "pointer" }}>Track order</button>
            </form>
          </>
        )}

        {result && <OrderView order={result.order} shipments={result.shipments} events={result.events} />}
      </main>
    </StoreChrome>
  );
}

const JOURNEY = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"] as const;
const JOURNEY_LABEL: Record<string, string> = {
  placed: "Order placed", confirmed: "Confirmed", packed: "Packed",
  shipped: "Shipped", out_for_delivery: "Out for delivery", delivered: "Delivered",
};

/** Where the order sits on the fulfilment journey (partial shipping counts as shipped). */
function journeyPos(status: string): number {
  if (status === "partially_shipped") return JOURNEY.indexOf("shipped");
  const i = JOURNEY.indexOf(status as any);
  return i === -1 ? 0 : i;
}

function JourneyBar({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 600 }}>
        This order was cancelled. If you were charged, the refund follows our returns policy — reply to any order email and we&apos;ll sort it out.
      </div>
    );
  }
  const pos = journeyPos(status);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", margin: "2px 0 4px" }}>
      {JOURNEY.map((st, i) => {
        const done = i < pos, active = i === pos;
        return (
          <div key={st} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
            {i > 0 && <div style={{ position: "absolute", top: 7, right: "50%", width: "100%", height: 2, background: i <= pos ? "#1F9D63" : "#E0E4ED" }} />}
            <span style={{ zIndex: 1, width: 15, height: 15, borderRadius: "50%", background: done || active ? "#1F9D63" : "#fff", border: done || active ? "none" : "2px solid #D6DBE6", boxShadow: active ? "0 0 0 4px #E6F5EE" : "none" }} />
            <span style={{ fontSize: 10, marginTop: 6, fontWeight: active ? 700 : 500, color: done || active ? "#137a4b" : "#A0A7B5", textAlign: "center", lineHeight: 1.25 }}>{JOURNEY_LABEL[st]}</span>
          </div>
        );
      })}
    </div>
  );
}

function OrderView({ order, shipments, events }: { order: any; shipments: any[]; events: any[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "var(--space-mono)", fontSize: 16, fontWeight: 700 }}>{order.id}</div>
            <div style={{ fontSize: 12.5, color: "#8A93A6" }}>Placed {new Date(order.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" } as any)}</div>
          </div>
          <OrderStatusBadge status={order.status} size={13} />
        </div>
        <div style={{ marginTop: 16 }}>
          <JourneyBar status={order.status} />
        </div>
        <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 14, paddingTop: 12 }}>
          {(order.items ?? []).map((it: any) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "4px 0", color: "#3A4358" }}>
              <span>{it.qty}× {it.name}</span>{it.price != null && <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 600 }}>{fmt(it.price * it.qty)}</span>}
            </div>
          ))}
          {order.total != null && (
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10, fontWeight: 700 }}>
              <span>Total</span><span style={{ fontFamily: "var(--space-grotesk)" }}>{fmt(order.total)}</span>
            </div>
          )}
        </div>
      </div>

      {shipments.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>Shipments</div>
          {shipments.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid #F4F5F8" }}>
              <div style={{ fontSize: 13 }}>
                <b>{s.courier || "Parcel"}</b>{s.awb && <span style={{ fontFamily: "var(--space-mono)", color: "#56627A" }}> · {s.awb}</span>}
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>{(s.items ?? []).map((i: any) => `${i.qty}× ${i.name}`).join(", ")}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {s.tracking_url && <a href={s.tracking_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#4E5BDC", fontWeight: 600 }}>Track →</a>}
                <OrderStatusBadge status={s.status} size={11} />
              </div>
            </div>
          ))}
        </div>
      )}

      {events.length > 0 && <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>Progress</div>
        {events.map((e, i) => (
          <div key={e.id} style={{ display: "flex", gap: 11, paddingBottom: i === events.length - 1 ? 0 : 14 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4E5BDC", marginTop: 4, flexShrink: 0 }} />
              {i < events.length - 1 && <span style={{ width: 2, flex: 1, background: "#E8EBF1", marginTop: 2 }} />}
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{STATUS_LABEL(e.status)}</div>
              {e.note && <div style={{ fontSize: 12, color: "#8A93A6" }}>{e.note}</div>}
              <div style={{ fontSize: 11, color: "#B0B7C3" }}>{new Date(e.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" } as any)}</div>
            </div>
          </div>
        ))}
      </div>}

      <Link href="/catalogue" style={{ textAlign: "center", fontSize: 13, color: "#4E5BDC", fontWeight: 600 }}>Continue shopping →</Link>
    </div>
  );
}

const lbl: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 5 };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none" };
