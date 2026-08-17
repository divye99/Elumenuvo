import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import Link from "next/link";

/**
 * Logistics console - courier intelligence from order_shipments telemetry
 * (migration 0113, fed by the Shiprocket ship panel + tracking sync).
 *
 * Four views:
 *   1. Courier scorecard - promised vs actual days, on-time %, RTO %, cost
 *   2. Time-loss funnel  - where the days go: packing, pickup wait, transit
 *   3. Cost & weight     - freight paid vs delivery charged; billed-weight audit
 *   4. In-flight board   - every open parcel with its latest scan
 */
export const dynamic = "force-dynamic";

const DAY = 86_400_000;
type Ship = {
  id: string; order_id: string; courier: string | null; courier_id: number | null; awb: string | null;
  status: string; shipped_at: string | null; delivered_at: string | null;
  freight_charge: number | null; entered_weight_kg: number | null; billed_weight_kg: number | null;
  dims_cm: string | null; etd: string | null; promised_days: number | null;
  manifest_at: string | null; picked_up_at: string | null; sr_status: string | null;
  sr_events: { time: string; status: string; location: string }[] | null;
  pickup_location: string | null; created_at: string;
};

const days = (a?: string | null, b?: string | null): number | null => {
  if (!a || !b) return null;
  const d = (new Date(b).getTime() - new Date(a).getTime()) / DAY;
  return Number.isFinite(d) ? Math.max(0, d) : null;
};
const avg = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};
const d1 = (n: number | null) => (n == null ? "-" : n.toFixed(1));
const pct = (n: number | null) => (n == null ? "-" : `${Math.round(n * 100)}%`);
const rs = (n: number | null) => (n == null ? "-" : `₹${Math.round(n).toLocaleString("en-IN")}`);

export default async function LogisticsPage() {
  await requireAdmin();
  const db = adminClient();
  if (!db) return <p style={{ color: "#8A93A6" }}>Service key missing.</p>;

  let { data: ships, error } = await db.from("order_shipments").select("*").not("awb", "is", null).order("created_at", { ascending: false }).limit(1000);
  if (error) ({ data: ships } = await db.from("order_shipments").select("*").order("created_at", { ascending: false }).limit(1000));
  const all = (ships ?? []) as Ship[];

  const orderIds = [...new Set(all.map((s) => s.order_id))];
  const { data: orderRows } = orderIds.length
    ? await db.from("orders").select("id, created_at, shipping_fee, shipping_address, total").in("id", orderIds)
    : { data: [] as any[] };
  const orders = new Map((orderRows ?? []).map((o: any) => [o.id as string, o]));

  /* Per-shipment derived timings */
  const enriched = all.map((s) => {
    const o = orders.get(s.order_id);
    const handedOver = s.picked_up_at ?? s.shipped_at;
    return {
      ...s,
      orderAt: o?.created_at as string | undefined,
      deliveryFeeCharged: o ? Number(o.shipping_fee ?? 0) : null,
      packDays: days(o?.created_at, s.manifest_at ?? s.shipped_at),
      pickupWaitDays: days(s.manifest_at, s.picked_up_at),
      transitDays: days(handedOver, s.delivered_at),
      totalDays: days(o?.created_at, s.delivered_at),
      promised: s.etd && (s.manifest_at ?? s.shipped_at) ? days(s.manifest_at ?? s.shipped_at, s.etd) : (s.promised_days ?? null),
      onTime: s.delivered_at && s.etd ? new Date(s.delivered_at).getTime() <= new Date(s.etd).getTime() + DAY / 2 : null,
    };
  });

  /* 1. Courier scorecard */
  const byCourier = new Map<string, typeof enriched>();
  for (const s of enriched) {
    const k = s.courier || "Unknown";
    byCourier.set(k, [...(byCourier.get(k) ?? []), s]);
  }
  const scorecard = [...byCourier.entries()].map(([name, list]) => {
    const delivered = list.filter((s) => s.delivered_at);
    const judged = delivered.filter((s) => s.onTime != null);
    const promised = avg(list.map((s) => s.promised));
    const actual = avg(delivered.map((s) => s.transitDays));
    return {
      name,
      count: list.length,
      delivered: delivered.length,
      promised, actual,
      slip: promised != null && actual != null ? actual - promised : null,
      onTime: judged.length ? judged.filter((s) => s.onTime).length / judged.length : null,
      rto: list.length ? list.filter((s) => s.sr_status === "rto").length / list.length : null,
      freight: avg(list.map((s) => (s.freight_charge != null ? Number(s.freight_charge) : null))),
      perKg: avg(list.map((s) => (s.freight_charge != null && s.entered_weight_kg ? Number(s.freight_charge) / Number(s.entered_weight_kg) : null))),
    };
  }).sort((a, b) => b.count - a.count);

  /* 2. Time-loss funnel (delivered parcels only) */
  const done = enriched.filter((s) => s.delivered_at);
  const funnel = {
    pack: avg(done.map((s) => s.packDays)),
    pickupWait: avg(done.map((s) => s.pickupWaitDays)),
    transit: avg(done.map((s) => s.transitDays)),
    total: avg(done.map((s) => s.totalDays)),
    n: done.length,
  };

  /* 3. Cost totals + weight audit */
  const withFreight = enriched.filter((s) => s.freight_charge != null);
  const freightPaid = withFreight.reduce((sum, s) => sum + Number(s.freight_charge), 0);
  const feeCharged = withFreight.reduce((sum, s) => sum + Number(s.deliveryFeeCharged ?? 0), 0);
  const weightFlags = enriched.filter((s) => s.billed_weight_kg != null && s.entered_weight_kg != null && Number(s.billed_weight_kg) > Number(s.entered_weight_kg) + 0.05);

  /* 4. In-flight */
  const inFlight = enriched.filter((s) => s.status !== "delivered" && s.sr_status !== "rto" && s.sr_status !== "lost");

  const th: React.CSSProperties = { textAlign: "left", fontSize: 10.5, letterSpacing: "0.8px", textTransform: "uppercase", color: "#8A93A6", padding: "8px 10px", borderBottom: "1px solid #E8EBF1", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { fontSize: 13, padding: "9px 10px", borderBottom: "1px solid #F0F2F6", whiteSpace: "nowrap" };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "16px 16px 8px", marginBottom: 16, overflowX: "auto" };
  const h2: React.CSSProperties = { fontSize: 14, fontWeight: 800, margin: "0 0 4px", color: "#19202E" };
  const sub: React.CSSProperties = { fontSize: 12, color: "#8A93A6", margin: "0 0 10px" };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px" }}>Logistics</h1>
      <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>
        Telemetry from Shiprocket bookings. Parcels shipped manually (no AWB telemetry) appear with blank cost/promise columns.
      </p>

      {/* Funnel strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          ["Order → handover", d1(funnel.pack != null && funnel.pickupWait != null ? funnel.pack + funnel.pickupWait : funnel.pack), `packing ${d1(funnel.pack)}d + pickup wait ${d1(funnel.pickupWait)}d`],
          ["Handover → delivered", d1(funnel.transit), "courier transit time"],
          ["Order → delivered", d1(funnel.total), "what the customer experiences"],
          ["Delivered parcels", String(funnel.n), "in this sample"],
        ].map(([k, v, s]) => (
          <div key={k} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 10, padding: "13px 14px" }}>
            <div style={{ fontSize: 11, color: "#8A93A6", fontWeight: 700 }}>{k}</div>
            <div style={{ fontFamily: "var(--space-grotesk)", fontSize: 22, fontWeight: 700, margin: "2px 0" }}>{v}{k !== "Delivered parcels" ? <span style={{ fontSize: 12, color: "#8A93A6" }}> days</span> : null}</div>
            <div style={{ fontSize: 10.5, color: "#A0A7B5" }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Scorecard */}
      <div style={card}>
        <h2 style={h2}>Courier scorecard</h2>
        <p style={sub}>Promise = ETD at booking; actual = pickup to delivery. Slip above +1d, on-time under 80% or RTO above 5% is a courier to stop using for that lane.</p>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 720 }}>
          <thead><tr>{["Courier", "Parcels", "Delivered", "Promised d", "Actual d", "Slip d", "On-time", "RTO", "Avg freight", "₹/kg"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {scorecard.length === 0 && <tr><td style={td} colSpan={10}>No shipments yet - book the first parcel from an order page.</td></tr>}
            {scorecard.map((c) => (
              <tr key={c.name}>
                <td style={{ ...td, fontWeight: 700 }}>{c.name}</td>
                <td style={td}>{c.count}</td>
                <td style={td}>{c.delivered}</td>
                <td style={td}>{d1(c.promised)}</td>
                <td style={td}>{d1(c.actual)}</td>
                <td style={{ ...td, color: c.slip != null && c.slip > 1 ? "#C2410C" : c.slip != null && c.slip <= 0 ? "#1F9D63" : undefined, fontWeight: 700 }}>{c.slip == null ? "-" : (c.slip > 0 ? "+" : "") + c.slip.toFixed(1)}</td>
                <td style={{ ...td, color: c.onTime != null && c.onTime < 0.8 ? "#C2410C" : undefined }}>{pct(c.onTime)}</td>
                <td style={{ ...td, color: c.rto != null && c.rto > 0.05 ? "#C2410C" : undefined }}>{pct(c.rto)}</td>
                <td style={td}>{rs(c.freight)}</td>
                <td style={td}>{rs(c.perKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cost + weight audit */}
      <div style={card}>
        <h2 style={h2}>Freight economics</h2>
        <p style={sub}>Across {withFreight.length} Shiprocket-booked parcels. "Charged" is the delivery + heavy-item fee the customer paid on those orders.</p>
        <div style={{ display: "flex", gap: 26, flexWrap: "wrap", paddingBottom: 10 }}>
          {[
            ["Freight paid to couriers", rs(freightPaid)],
            ["Delivery charged to customers", rs(feeCharged)],
            ["Net freight margin", rs(feeCharged - freightPaid)],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: "#8A93A6", fontWeight: 700 }}>{k}</div>
              <div style={{ fontFamily: "var(--space-grotesk)", fontSize: 20, fontWeight: 700, color: k.startsWith("Net") ? (feeCharged - freightPaid >= 0 ? "#1F9D63" : "#C2410C") : "#19202E" }}>{v}</div>
            </div>
          ))}
        </div>
        {weightFlags.length > 0 && (
          <>
            <h2 style={{ ...h2, marginTop: 6 }}>⚠ Billed-weight disputes ({weightFlags.length})</h2>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
              <thead><tr>{["Order", "Courier", "AWB", "Entered kg", "Billed kg", "Freight"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {weightFlags.map((s) => (
                  <tr key={s.id}>
                    <td style={td}><Link href={`/admin/orders/${s.order_id}`} style={{ color: "#4E5BDC", fontWeight: 600 }}>{s.order_id}</Link></td>
                    <td style={td}>{s.courier}</td>
                    <td style={{ ...td, fontFamily: "var(--space-mono)", fontSize: 12 }}>{s.awb}</td>
                    <td style={td}>{s.entered_weight_kg}</td>
                    <td style={{ ...td, color: "#C2410C", fontWeight: 700 }}>{s.billed_weight_kg}</td>
                    <td style={td}>{rs(s.freight_charge != null ? Number(s.freight_charge) : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* In-flight */}
      <div style={card}>
        <h2 style={h2}>In flight ({inFlight.length})</h2>
        <p style={sub}>Every open parcel with its latest courier scan. Synced every 3 hours + on webhook pushes.</p>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
          <thead><tr>{["Order", "Courier", "AWB", "Status", "Days out", "ETD", "Last scan"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {inFlight.length === 0 && <tr><td style={td} colSpan={7}>Nothing in transit.</td></tr>}
            {inFlight.map((s) => {
              const lastScan = s.sr_events?.[0];
              const out = days(s.picked_up_at ?? s.shipped_at, new Date().toISOString());
              const late = s.etd && new Date() > new Date(s.etd);
              return (
                <tr key={s.id}>
                  <td style={td}><Link href={`/admin/orders/${s.order_id}`} style={{ color: "#4E5BDC", fontWeight: 600 }}>{s.order_id}</Link></td>
                  <td style={td}>{s.courier ?? "-"}</td>
                  <td style={{ ...td, fontFamily: "var(--space-mono)", fontSize: 12 }}>{s.awb}</td>
                  <td style={{ ...td, fontWeight: 700, color: late ? "#C2410C" : undefined }}>{s.sr_status ?? s.status}{late ? " · LATE" : ""}</td>
                  <td style={td}>{d1(out)}</td>
                  <td style={td}>{s.etd ? new Date(s.etd).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" }) : "-"}</td>
                  <td style={{ ...td, whiteSpace: "normal", maxWidth: 260, fontSize: 12, color: "#56627A" }}>{lastScan ? `${lastScan.status} · ${lastScan.location}` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const metadata = { title: "Logistics · Elume Admin" };
