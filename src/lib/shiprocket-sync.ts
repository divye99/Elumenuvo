/**
 * Tracking sync - pulls Shiprocket's latest scans into order_shipments and
 * rolls order statuses forward. Runs from the cron (every 3h) and from the
 * webhook (per-AWB, on Shiprocket's push). Uses the service client directly:
 * no admin cookie exists in either context.
 *
 * The webhook body is treated only as a SIGNAL - the authoritative state is
 * always re-fetched from the tracking API, so a malformed or spoofed payload
 * can at worst trigger an extra read.
 */
import { createClient } from "@supabase/supabase-js";
import { timeoutFetch } from "@/lib/supabase/fetch-timeout";
import { trackByAwb } from "@/lib/shiprocket";
import { sendCustomerStatusUpdate } from "@/lib/email";

function service() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false }, global: { fetch: timeoutFetch } });
}

const FINAL = new Set(["delivered", "rto", "lost"]);

/** Sync one shipment row against live tracking. Returns what changed. */
async function syncRow(db: NonNullable<ReturnType<typeof service>>, s: any): Promise<string> {
  const snap = await trackByAwb(s.awb).catch(() => null);
  if (!snap) return "no-data";

  const patch: Record<string, unknown> = {
    sr_status: snap.status,
    sr_events: snap.scans.slice(0, 100),
    ...(snap.etd ? { etd: new Date(snap.etd).toISOString() } : {}),
    ...(snap.pickedUpAt && !s.picked_up_at ? { picked_up_at: new Date(snap.pickedUpAt).toISOString() } : {}),
  };

  const nowDelivered = snap.status === "delivered" && s.status !== "delivered";
  if (nowDelivered) {
    patch.status = "delivered";
    patch.delivered_at = snap.deliveredAt ? new Date(snap.deliveredAt).toISOString() : new Date().toISOString();
  }

  let { error } = await db.from("order_shipments").update(patch).eq("id", s.id);
  if (error && error.code === "42703") {
    // Pre-0113 database: keep only the columns that have always existed.
    const minimal: Record<string, unknown> = {};
    if (patch.status) minimal.status = patch.status;
    if (patch.delivered_at) minimal.delivered_at = patch.delivered_at;
    if (Object.keys(minimal).length) ({ error } = await db.from("order_shipments").update(minimal).eq("id", s.id));
    else error = null;
  }
  if (error) return `error:${error.message}`;

  if (nowDelivered) {
    // Roll up to the order exactly like the manual "Mark delivered" flow.
    const { data: siblings } = await db.from("order_shipments").select("status").eq("order_id", s.order_id);
    const allDelivered = (siblings ?? []).length > 0 && (siblings ?? []).every((x: any) => x.status === "delivered");
    const { data: order } = await db.from("orders").select("*").eq("id", s.order_id).maybeSingle();
    const nowIso = new Date().toISOString();
    if (allDelivered && order && order.status !== "delivered") {
      await db.from("orders").update({ status: "delivered", delivered_at: nowIso, updated_at: nowIso }).eq("id", s.order_id);
      try { await db.from("order_events").insert({ order_id: s.order_id, status: "delivered", note: `Delivered (courier scan · AWB ${s.awb})` }); } catch { /* optional */ }
      try { if (order.email) await sendCustomerStatusUpdate(order, "delivered"); } catch { /* best-effort */ }
    }
    return "delivered";
  }
  if (snap.status === "out_for_delivery" && s.sr_status !== "out_for_delivery") {
    const { data: order } = await db.from("orders").select("id,status").eq("id", s.order_id).maybeSingle();
    if (order && !["delivered", "cancelled", "out_for_delivery"].includes(order.status)) {
      await db.from("orders").update({ status: "out_for_delivery", updated_at: new Date().toISOString() }).eq("id", s.order_id);
      try { await db.from("order_events").insert({ order_id: s.order_id, status: "out_for_delivery", note: `Out for delivery (courier scan · AWB ${s.awb})` }); } catch { /* optional */ }
    }
    return "out_for_delivery";
  }
  return snap.status === String(s.sr_status ?? "") ? "unchanged" : `-> ${snap.status}`;
}

/** Sync every open Shiprocket-booked shipment. Returns a per-AWB report. */
export async function syncOpenShipments(limit = 50): Promise<Record<string, string>> {
  const db = service();
  if (!db) return { error: "service client unavailable" };
  let { data: rows, error } = await db
    .from("order_shipments")
    .select("*")
    .not("awb", "is", null)
    .neq("status", "delivered")
    .not("sr_shipment_id", "is", null)
    .limit(limit);
  // Pre-0113: no sr_shipment_id column - fall back to every undelivered AWB.
  if (error) ({ data: rows } = await db.from("order_shipments").select("*").not("awb", "is", null).neq("status", "delivered").limit(limit));
  const report: Record<string, string> = {};
  for (const s of rows ?? []) {
    if (FINAL.has(String(s.sr_status ?? ""))) continue;
    report[s.awb] = await syncRow(db, s);
  }
  return report;
}

/** Sync a single AWB (webhook path). */
export async function syncAwb(awb: string): Promise<string> {
  const db = service();
  if (!db) return "service client unavailable";
  const { data: s } = await db.from("order_shipments").select("*").eq("awb", awb).maybeSingle();
  if (!s) return "unknown-awb";
  return syncRow(db, s);
}
