/**
 * Shiprocket API client (server-only) - the courier pipeline behind the admin
 * ship panel and the Logistics tab.
 *
 * Auth: an API-user login yields a bearer token valid ~10 days. Serverless
 * functions share one token through app_kv (migration 0113) instead of
 * re-logging-in per invocation; on a 401 the token is refreshed once and the
 * call retried. If app_kv is missing the client still works - it just logs
 * in per process.
 *
 * The full booking flow (create adhoc order -> assign AWB -> schedule pickup
 * -> generate label) is one call here: shipOrder(). Each step's failure
 * surfaces the Shiprocket message verbatim - courier errors ("pickup not
 * serviceable", "insufficient wallet balance") are actionable, not noise.
 */
import { createClient } from "@supabase/supabase-js";
import { GST_STATE_BY_CODE } from "@/lib/gstin";

const BASE = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_KEY = "shiprocket_token";
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // refresh a day before the 10-day expiry

function service() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function login(): Promise<string> {
  const email = (process.env.SHIPROCKET_EMAIL ?? "").trim();
  const password = process.env.SHIPROCKET_PASSWORD ?? "";
  if (!email || !password) throw new Error("SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD not configured.");
  const r = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.token) throw new Error(`Shiprocket login failed (${r.status}): ${j?.message ?? "no token"}`);
  const db = service();
  if (db) {
    await db.from("app_kv").upsert({ k: TOKEN_KEY, v: { token: j.token, at: Date.now() }, updated_at: new Date().toISOString() }).then(() => {}, () => {});
  }
  return j.token as string;
}

async function token(forceFresh = false): Promise<string> {
  if (!forceFresh) {
    const db = service();
    if (db) {
      const { data } = await db.from("app_kv").select("v").eq("k", TOKEN_KEY).maybeSingle();
      const v = data?.v as { token?: string; at?: number } | undefined;
      if (v?.token && v.at && Date.now() - v.at < TOKEN_TTL_MS) return v.token;
    }
  }
  return login();
}

/** Authenticated Shiprocket call; retries exactly once on 401 with a fresh token. */
async function api<T = any>(path: string, init?: RequestInit & { retry?: boolean }): Promise<T> {
  const t = await token();
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, ...(init?.headers ?? {}) },
  });
  if (r.status === 401 && init?.retry !== false) {
    await token(true);
    return api(path, { ...init, retry: false });
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Shiprocket ${path} failed (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  return j as T;
}

/* ── Pickup locations ─────────────────────────────────────────────── */

export type PickupLocation = { name: string; city: string; pin: string };

export async function pickupLocations(): Promise<PickupLocation[]> {
  const j = await api<any>("/settings/company/pickup");
  return ((j?.data?.shipping_address ?? []) as any[]).map((a) => ({
    name: String(a.pickup_location), city: String(a.city ?? ""), pin: String(a.pin_code ?? ""),
  }));
}

/* ── Serviceability / rates ───────────────────────────────────────── */

export type CourierOption = {
  courierId: number;
  name: string;
  rate: number;                 // what Shiprocket charges us, Rs
  etd: string;                  // "Aug 19, 2026"
  estimatedDays: number;
  rating: number | null;
  cod: boolean;
  /** Weight the courier will BILL: max(dead weight, volumetric L*B*H/5000). */
  chargeWeightKg: number | null;
  /** Days until the courier can pick up (0 = today, 1 = tomorrow, ...). */
  pickupInDays: number | null;
  /** Same-day pickup order cutoff, e.g. "11:00". */
  cutoffTime: string | null;
  mode: "Surface" | "Air";
  pickupRating: number | null;
  deliveryRating: number | null;
  realtimeTracking: boolean;
  callBeforeDelivery: boolean;
};

export async function getRates(input: {
  pickupPin: string; deliveryPin: string; weightKg: number;
  lengthCm?: number; breadthCm?: number; heightCm?: number;
  cod?: boolean; declaredValue?: number;
}): Promise<CourierOption[]> {
  const q = new URLSearchParams({
    pickup_postcode: input.pickupPin,
    delivery_postcode: input.deliveryPin,
    weight: String(input.weightKg),
    cod: input.cod ? "1" : "0",
  });
  if (input.declaredValue) q.set("declared_value", String(Math.round(input.declaredValue)));
  if (input.lengthCm) q.set("length", String(input.lengthCm));
  if (input.breadthCm) q.set("breadth", String(input.breadthCm));
  if (input.heightCm) q.set("height", String(input.heightCm));
  const j = await api<any>(`/courier/serviceability/?${q}`);
  const list = (j?.data?.available_courier_companies ?? []) as any[];
  return list
    .map((c) => ({
      courierId: Number(c.courier_company_id),
      name: String(c.courier_name),
      rate: Number(c.rate),
      etd: String(c.etd ?? ""),
      estimatedDays: Number(c.estimated_delivery_days) || 0,
      rating: c.rating != null ? Number(c.rating) : null,
      cod: Number(c.cod) === 1,
      chargeWeightKg: c.charge_weight != null ? Number(c.charge_weight) : null,
      pickupInDays: c.pickup_availability != null && c.pickup_availability !== "" ? Number(c.pickup_availability) : null,
      cutoffTime: c.cutoff_time ? String(c.cutoff_time) : null,
      mode: (c.is_surface === true || c.is_surface === "true" ? "Surface" : "Air") as "Surface" | "Air",
      pickupRating: c.pickup_performance != null ? Number(c.pickup_performance) : null,
      deliveryRating: c.delivery_performance != null ? Number(c.delivery_performance) : null,
      realtimeTracking: /real/i.test(String(c.realtime_tracking ?? "")),
      callBeforeDelivery: /avail/i.test(String(c.call_before_delivery ?? "")),
    }))
    .sort((a, b) => a.rate - b.rate);
}

/* ── Booking ──────────────────────────────────────────────────────── */

/** Split a free-text Indian address into Shiprocket's structured fields.
 *  Structured address_details (post-0076 orders) should be preferred by the
 *  caller; this is the fallback for legacy orders. */
export function parseAddress(text: string): { address: string; city: string; state: string; pincode: string } {
  const pin = text.match(/\b\d{6}\b/)?.[0] ?? "";
  let state = "";
  const hay = text.toLowerCase();
  for (const name of Object.values(GST_STATE_BY_CODE).sort((a, b) => b.length - a.length)) {
    if (hay.includes(name.toLowerCase())) { state = name; break; }
  }
  // City guess: the comma-part right before the state (or before the PIN).
  const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
  let city = "";
  const stateIdx = parts.findIndex((p) => state && p.toLowerCase().includes(state.toLowerCase()));
  if (stateIdx > 0) city = parts[stateIdx - 1].replace(/\b\d{6}\b/, "").trim();
  else if (parts.length >= 2) city = parts[parts.length - 2].replace(/\b\d{6}\b/, "").trim();
  return { address: text, city: city || "-", state: state || "-", pincode: pin };
}

export type ShipOrderInput = {
  order: {
    id: string; created_at: string; name: string | null; email: string; phone: string | null;
    shipping_address: string | null; billing_address: string | null;
    payment_method: string | null; total: number | null;
    items: { id: string; name: string; qty: number; price?: number; hsn?: string }[];
    address_details?: { shipping?: { line1?: string; line2?: string; line3?: string; city?: string; state?: string; pin?: string } } | null;
  };
  items: { id: string; name: string; qty: number }[]; // what THIS parcel carries
  pickupLocation: string;
  courierId: number;
  weightKg: number;
  lengthCm: number; breadthCm: number; heightCm: number;
};

export type ShipOrderResult = {
  srOrderId: number; srShipmentId: number; awb: string; courierName: string;
  freight: number | null; labelUrl: string | null; pickupScheduled: boolean; pickupError?: string;
};

export async function shipOrder(input: ShipOrderInput): Promise<ShipOrderResult> {
  const o = input.order;
  const s = o.address_details?.shipping;
  const addr = s?.line1?.trim()
    ? {
        address: [s.line1, s.line2, s.line3].filter(Boolean).join(", "),
        city: s.city || "-", state: s.state || "-", pincode: s.pin || "",
      }
    : parseAddress(o.shipping_address ?? "");
  if (!/^\d{6}$/.test(addr.pincode)) throw new Error(`No 6-digit PIN found in the shipping address - fix the address first.`);

  const priced = input.items.map((it) => {
    const full = o.items.find((x) => x.id === it.id);
    return {
      name: it.name.slice(0, 100), sku: it.id.slice(0, 40), units: it.qty,
      selling_price: Math.round(Number(full?.price ?? 0)) || 1,
      hsn: full?.hsn ? Number(String(full.hsn).replace(/\D/g, "")) || undefined : undefined,
    };
  });
  const subTotal = priced.reduce((sum, p) => sum + p.selling_price * p.units, 0);

  // 1. Create the adhoc order.
  const created = await api<any>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify({
      order_id: o.id,
      order_date: new Date(o.created_at).toISOString().slice(0, 10),
      pickup_location: input.pickupLocation,
      billing_customer_name: (o.name || "Customer").split(/\s+/)[0],
      billing_last_name: (o.name || "").split(/\s+/).slice(1).join(" ") || "-",
      billing_address: addr.address.slice(0, 250),
      billing_city: addr.city, billing_pincode: addr.pincode, billing_state: addr.state,
      billing_country: "India", billing_email: o.email, billing_phone: (o.phone ?? "").replace(/\D/g, "").slice(-10),
      shipping_is_billing: true,
      order_items: priced,
      payment_method: "Prepaid", // all Elume orders are captured online before shipping
      sub_total: subTotal,
      length: input.lengthCm, breadth: input.breadthCm, height: input.heightCm,
      weight: input.weightKg,
    }),
  });
  const srOrderId = Number(created?.order_id);
  const srShipmentId = Number(created?.shipment_id);
  if (!srOrderId || !srShipmentId) throw new Error(`Shiprocket order create returned no ids: ${JSON.stringify(created).slice(0, 200)}`);

  // 2. Assign the chosen courier's AWB.
  const assigned = await api<any>("/courier/assign/awb", {
    method: "POST",
    body: JSON.stringify({ shipment_id: srShipmentId, courier_id: input.courierId }),
  });
  const awbData = assigned?.response?.data ?? assigned?.data ?? {};
  const awb = String(awbData?.awb_code ?? "");
  if (!awb) throw new Error(`AWB assignment failed: ${JSON.stringify(assigned).slice(0, 300)}`);
  const courierName = String(awbData?.courier_name ?? "");
  const freight = awbData?.freight_charges != null ? Number(awbData.freight_charges) : null;

  // 3. Schedule pickup - non-fatal: a parcel with an AWB can have its pickup
  // re-requested from Shiprocket's panel if this step hiccups.
  let pickupScheduled = false; let pickupError: string | undefined;
  try {
    await api<any>("/courier/generate/pickup", { method: "POST", body: JSON.stringify({ shipment_id: [srShipmentId] }) });
    pickupScheduled = true;
  } catch (e) { pickupError = e instanceof Error ? e.message : String(e); }

  // 4. Label PDF - also non-fatal.
  let labelUrl: string | null = null;
  try {
    const label = await api<any>("/courier/generate/label", { method: "POST", body: JSON.stringify({ shipment_id: [srShipmentId] }) });
    labelUrl = label?.label_url ? String(label.label_url) : null;
  } catch { /* printable later from Shiprocket panel */ }

  return { srOrderId, srShipmentId, awb, courierName, freight, labelUrl, pickupScheduled, pickupError };
}

/* ── Tracking ─────────────────────────────────────────────────────── */

export type TrackingSnapshot = {
  status: string;               // normalised: manifested|picked_up|in_transit|out_for_delivery|delivered|rto|lost
  rawStatus: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  etd: string | null;
  scans: { time: string; status: string; location: string }[];
};

const STATUS_MAP: [RegExp, TrackingSnapshot["status"]][] = [
  [/deliver/i, "delivered"],
  [/out for delivery/i, "out_for_delivery"],
  [/rto|return/i, "rto"],
  [/lost|damaged|destroy/i, "lost"],
  [/pick.?up|picked/i, "picked_up"],
  [/transit|shipped|dispatch|reached|arriv/i, "in_transit"],
  [/manifest|awb|label|not picked/i, "manifested"],
];

export async function trackByAwb(awb: string): Promise<TrackingSnapshot | null> {
  const j = await api<any>(`/courier/track/awb/${encodeURIComponent(awb)}`);
  const td = j?.tracking_data;
  if (!td) return null;
  const track = (td.shipment_track ?? [])[0] ?? {};
  const acts = (td.shipment_track_activities ?? []) as any[];
  const raw = String(track.current_status ?? td.shipment_status ?? "");
  const norm = STATUS_MAP.find(([re]) => re.test(raw))?.[1] ?? "in_transit";
  return {
    status: norm,
    rawStatus: raw,
    pickedUpAt: track.pickup_date ? String(track.pickup_date) : null,
    deliveredAt: track.delivered_date ? String(track.delivered_date) : null,
    etd: td.etd ? String(td.etd) : null,
    scans: acts.map((a) => ({ time: String(a.date ?? ""), status: String(a.activity ?? a["sr-status-label"] ?? ""), location: String(a.location ?? "") })),
  };
}
