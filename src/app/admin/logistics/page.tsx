import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { walletBalance } from "@/lib/shiprocket";
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

  const [shipsRes, balance, quotesRes, issuesRes] = await Promise.all([
    db.from("order_shipments").select("*").not("awb", "is", null).order("created_at", { ascending: false }).limit(1000),
    walletBalance().catch(() => null),
    db.from("courier_quotes").select("courier_name, delivery_state, mode, rate, est_days, charge_weight_kg, distance_km, chosen").order("created_at", { ascending: false }).limit(5000),
    // Delivery incidents (0126): the reason-classified failures. Tolerates
    // the table being absent pre-migration.
    db.from("delivery_issues").select("order_id, courier, kind, fault, reason, status, created_at").order("created_at", { ascending: false }).limit(2000).then((r) => r, () => ({ data: [] as any[] })),
  ]);
  let ships = shipsRes.data;
  if (shipsRes.error) ({ data: ships } = await db.from("order_shipments").select("*").order("created_at", { ascending: false }).limit(1000));
  const all = (ships ?? []) as Ship[];
  const quotes = (quotesRes.data ?? []) as { courier_name: string; delivery_state: string | null; mode: string | null; rate: number; est_days: number | null; charge_weight_kg: number | null; distance_km: number | null; chosen: boolean }[];

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
  // Fault-classified delivery incidents (0126). The scorecard blames a
  // courier ONLY for courier-fault incidents: a buyer who gave a wrong
  // address or refused the parcel is never the delivery partner's failure.
  type Issue = { order_id: string; courier: string | null; kind: string; fault: string; reason: string; status: string; created_at: string };
  const issues = (issuesRes.data ?? []) as Issue[];
  const issuesByCourier = new Map<string, Issue[]>();
  for (const i of issues) {
    const k = i.courier || "Unknown";
    issuesByCourier.set(k, [...(issuesByCourier.get(k) ?? []), i]);
  }

  const scorecard = [...byCourier.entries()].map(([name, list]) => {
    const delivered = list.filter((s) => s.delivered_at);
    const judged = delivered.filter((s) => s.onTime != null);
    const promised = avg(list.map((s) => s.promised));
    const actual = avg(delivered.map((s) => s.transitDays));
    const courierIssues = issuesByCourier.get(name) ?? [];
    return {
      name,
      count: list.length,
      delivered: delivered.length,
      promised, actual,
      slip: promised != null && actual != null ? actual - promised : null,
      onTime: judged.length ? judged.filter((s) => s.onTime).length / judged.length : null,
      rto: list.length ? list.filter((s) => s.sr_status === "rto").length / list.length : null,
      courierFaults: courierIssues.filter((i) => i.fault === "courier").length,
      otherFaults: courierIssues.filter((i) => i.fault !== "courier").length,
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

  /* Rate intelligence: per lane (destination state x weight band), how each
     courier PRICES and PROMISES. Every rate check in the ship panel logs all
     options here, so this sharpens with every quote - the foundation for a
     learned "best partner" recommendation once outcomes accumulate. */
  const band = (kg: number | null) => (kg == null ? "?" : kg < 2 ? "<2 kg" : kg < 5 ? "2-5 kg" : kg < 10 ? "5-10 kg" : "10+ kg");
  const lanes = new Map<string, Map<string, { rates: number[]; days: number[]; n: number; chosen: number }>>();
  const laneKm = new Map<string, number[]>();
  for (const q of quotes) {
    const laneKey = `${q.delivery_state ?? "Unknown"} · ${band(q.charge_weight_kg)}`;
    if (!lanes.has(laneKey)) lanes.set(laneKey, new Map());
    if (q.distance_km != null) { if (!laneKm.has(laneKey)) laneKm.set(laneKey, []); laneKm.get(laneKey)!.push(Number(q.distance_km)); }
    const l = lanes.get(laneKey)!;
    if (!l.has(q.courier_name)) l.set(q.courier_name, { rates: [], days: [], n: 0, chosen: 0 });
    const e = l.get(q.courier_name)!;
    e.rates.push(Number(q.rate)); if (q.est_days) e.days.push(q.est_days); e.n++; if (q.chosen) e.chosen++;
  }
  const laneDist = (key: string) => { const d = laneKm.get(key); return d?.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null; };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 2px" }}>Logistics</h1>
        {balance != null && (
          <span style={{ fontSize: 13, fontWeight: 700, color: balance < 500 ? "#C2410C" : "#1F9D63", background: balance < 500 ? "#FBE9E4" : "#E6F5EE", borderRadius: 9, padding: "6px 12px" }}>
            Shiprocket wallet: ₹{balance.toLocaleString("en-IN")}{balance < 500 ? " · low - recharge" : ""}
          </span>
        )}
      </div>
      <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>
        Telemetry from Shiprocket bookings. Parcels shipped manually (no AWB telemetry) appear with blank cost/promise columns - those fill from your first Shiprocket booking onward.
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
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 780 }}>
          <thead><tr>{["Courier", "Parcels", "Delivered", "Promised d", "Actual d", "Slip d", "On-time", "RTO", "Fails (their fault)", "Avg freight", "₹/kg"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {scorecard.length === 0 && <tr><td style={td} colSpan={11}>No shipments yet - book the first parcel from an order page.</td></tr>}
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
                <td style={{ ...td, color: c.courierFaults > 0 ? "#C2410C" : "#1F9D63", fontWeight: 700 }}>
                  {c.courierFaults}{c.otherFaults > 0 ? <span style={{ color: "#8A93A6", fontWeight: 400 }}> (+{c.otherFaults} not their fault)</span> : null}
                </td>
                <td style={td}>{rs(c.freight)}</td>
                <td style={td}>{rs(c.perKg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Failed deliveries + the reason metric (0126) */}
      {issues.length > 0 && (
        <div style={card}>
          <h2 style={h2}>Failed deliveries and why ({issues.length})</h2>
          <p style={sub}>
            Every incident carries its exact reason and whose fault it was. Buyer faults (wrong address, unreachable, refused)
            NEVER count against the courier; only courier-fault incidents feed the scorecard column.
          </p>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 680 }}>
            <thead><tr>{["Order", "Courier", "What happened", "Fault", "Exact reason", "Status", "When"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {issues.slice(0, 40).map((i, idx) => (
                <tr key={idx}>
                  <td style={td}><Link href={`/admin/orders/${i.order_id}`} style={{ color: "#1D2F8A", fontWeight: 600 }}>{i.order_id}</Link></td>
                  <td style={td}>{i.courier ?? "-"}</td>
                  <td style={td}>{i.kind.replace(/_/g, " ")}</td>
                  <td style={{ ...td, fontWeight: 700, color: i.fault === "courier" ? "#C2410C" : i.fault === "buyer" ? "#B7791F" : "#8A93A6" }}>{i.fault}</td>
                  <td style={{ ...td, whiteSpace: "normal", maxWidth: 300, fontSize: 12, color: "#56627A" }}>{i.reason}</td>
                  <td style={td}>{i.status.replace(/_/g, " ")}</td>
                  <td style={td}>{new Date(i.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    <td style={td}><Link href={`/admin/orders/${s.order_id}`} style={{ color: "#1D2F8A", fontWeight: 600 }}>{s.order_id}</Link></td>
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

      {/* Rate intelligence */}
      <div style={card}>
        <h2 style={h2}>Rate intelligence {quotes.length > 0 && <span style={{ fontWeight: 600, color: "#8A93A6", fontSize: 12 }}>· {quotes.length} quotes logged</span>}</h2>
        <p style={sub}>
          Every rate check logs every courier option (price, promised days, chargeable weight) per lane - destination state × weight band. The cheapest and the most-picked courier per lane emerge from your own data; as delivery outcomes accumulate, promised-vs-actual joins this to score true best partners.
        </p>
        {quotes.length === 0 ? (
          <p style={{ ...td, borderBottom: "none" }}>No quotes yet - run "Compare couriers" on any order and every option shown lands here (migration 0119).</p>
        ) : (
          [...lanes.entries()].map(([laneKey, l]) => {
            const rows = [...l.entries()].map(([name, e]) => ({
              name, n: e.n, chosen: e.chosen,
              avgRate: e.rates.reduce((a, b) => a + b, 0) / e.rates.length,
              minRate: Math.min(...e.rates),
              avgDays: e.days.length ? e.days.reduce((a, b) => a + b, 0) / e.days.length : null,
            })).sort((a, b) => a.avgRate - b.avgRate);
            const fastest = rows.filter((r) => r.avgDays != null).sort((a, b) => (a.avgDays! - b.avgDays!))[0]?.name;
            return (
              <div key={laneKey} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#3A4358", margin: "4px 0 6px" }}>
                  {laneKey}{laneDist(laneKey) != null ? <span style={{ fontWeight: 600, color: "#8A93A6" }}> · ~{laneDist(laneKey)!.toLocaleString("en-IN")} km from warehouse</span> : null}
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
                  <thead><tr>{["Courier", "Quotes", "Avg price", "Best price", "Avg promised d", "Picked"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.name}>
                        <td style={{ ...td, fontWeight: 700 }}>
                          {r.name}
                          {i === 0 && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#1F9D63", background: "#E6F5EE", borderRadius: 6, padding: "1px 6px" }}>CHEAPEST</span>}
                          {r.name === fastest && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#1D2F8A", background: "#E9EDF9", borderRadius: 6, padding: "1px 6px" }}>FASTEST</span>}
                        </td>
                        <td style={td}>{r.n}</td>
                        <td style={td}>{rs(r.avgRate)}</td>
                        <td style={td}>{rs(r.minRate)}</td>
                        <td style={td}>{r.avgDays != null ? r.avgDays.toFixed(1) : "-"}</td>
                        <td style={td}>{r.chosen > 0 ? `${r.chosen}×` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })
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
                  <td style={td}><Link href={`/admin/orders/${s.order_id}`} style={{ color: "#1D2F8A", fontWeight: 600 }}>{s.order_id}</Link></td>
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
