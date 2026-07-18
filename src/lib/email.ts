/**
 * Transactional email via the Resend REST API (no SDK dependency). Server-only.
 * Graceful: if RESEND_API_KEY is unset it logs and no-ops — order placement and
 * status changes must never fail because email is down.
 *
 * Env:
 *   RESEND_API_KEY        — Resend key (server secret; enables sending)
 *   ORDER_FROM_EMAIL      — verified sender, e.g. "Elume <info@elumenuvo.com>"
 *   ADMIN_EMAIL           — where new-order alerts go (default divye2014@gmail.com)
 *   NEXT_PUBLIC_SITE_URL  — base for tracking links (default https://elumenuvo.com)
 */
import { fmt } from "@/lib/format";

// All customer email comes from one identity: info@elumenuvo.com (the address
// verified in Resend and used for auth emails too). Overridable via env.
const FROM = process.env.ORDER_FROM_EMAIL || "Elume <info@elumenuvo.com>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "divye2014@gmail.com";
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://elumenuvo.com").replace(/\/+$/, "");

export type EmailResult = { ok: boolean; skipped?: boolean; error?: string };

type OrderLike = {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  total?: number | null;
  items?: { name: string; qty: number; price?: number }[] | null;
  shipping_address?: string | null;
  gstin?: string | null;
};

async function send(to: string, subject: string, html: string): Promise<EmailResult> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    console.log(`[email] RESEND_API_KEY unset — skipped "${subject}" → ${to}`);
    return { ok: false, skipped: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(`[email] send failed (${res.status}): ${body.slice(0, 200)}`);
      return { ok: false, error: `${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[email] send threw:", e instanceof Error ? e.message : e);
    return { ok: false, error: "network" };
  }
}

export function trackUrl(order: OrderLike): string {
  return `${SITE}/track?order=${encodeURIComponent(order.id)}&email=${encodeURIComponent(order.email)}`;
}

/* ── Shared HTML shell ── */
function shell(heading: string, bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#19202e">
    <div style="background:#161D2B;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;font-weight:700;font-size:18px">Elume</div>
    <div style="border:1px solid #E8EBF1;border-top:none;border-radius:0 0 12px 12px;padding:24px 22px">
      <h1 style="font-size:19px;margin:0 0 12px">${heading}</h1>
      ${bodyHtml}
      <p style="font-size:12px;color:#8A93A6;margin:22px 0 0;border-top:1px solid #F0F2F6;padding-top:14px">Elume Nuvotech Private Limited · Pan-India delivery · All prices include GST.</p>
    </div>
  </div>`;
}

function itemsTable(order: OrderLike): string {
  const rows = (order.items ?? [])
    .map((i) => `<tr><td style="padding:6px 0;color:#56627A">${i.qty}× ${escapeHtml(i.name)}</td><td style="padding:6px 0;text-align:right;font-weight:600">${i.price != null ? fmt(i.price * i.qty) : ""}</td></tr>`)
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:8px 0">${rows}
    ${order.total != null ? `<tr><td style="padding:10px 0 0;border-top:1px solid #F0F2F6;font-weight:700">Total</td><td style="padding:10px 0 0;border-top:1px solid #F0F2F6;text-align:right;font-weight:700">${fmt(order.total)}</td></tr>` : ""}
  </table>`;
}

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#4E5BDC;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:11px 22px;border-radius:10px;margin-top:6px">${label}</a>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c));
}

/* ── Public senders ── */

/** Alert the store owner that a new order arrived and needs fulfilment. */
export async function sendAdminNewOrder(order: OrderLike): Promise<EmailResult> {
  const html = shell(
    `New order ${order.id}`,
    `<p style="font-size:14px;color:#56627A;margin:0 0 6px">${escapeHtml(order.name || "A customer")} placed an order.</p>
     <p style="font-size:13px;color:#56627A;margin:0 0 10px">${escapeHtml(order.email)}${order.phone ? " · " + escapeHtml(order.phone) : ""}${order.gstin ? " · GSTIN " + escapeHtml(order.gstin) : ""}</p>
     ${itemsTable(order)}
     ${order.shipping_address ? `<p style="font-size:13px;color:#56627A;margin:10px 0"><b>Ship to:</b><br>${escapeHtml(order.shipping_address).replace(/\n/g, "<br>")}</p>` : ""}
     ${btn(`${SITE}/admin/orders/${encodeURIComponent(order.id)}`, "Open in admin →")}`
  );
  return send(ADMIN_EMAIL, `🛒 New order ${order.id} — ${order.total != null ? fmt(order.total) : ""}`, html);
}

/** Confirm the order to the customer, with a tracking link. */
export async function sendCustomerOrderConfirmation(order: OrderLike): Promise<EmailResult> {
  const html = shell(
    "Thanks for your order 🎉",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, we've received order <b>${order.id}</b> and will begin processing it. Pan-India delivery in 3–7 working days.</p>
     ${itemsTable(order)}
     <p style="font-size:13px;color:#56627A;margin:12px 0 4px">Track your order anytime:</p>
     ${btn(trackUrl(order), "Track my order →")}`
  );
  return send(order.email, `Order ${order.id} confirmed`, html);
}

/** Notify the customer their order status changed (optionally with tracking). */
export async function sendCustomerStatusUpdate(
  order: OrderLike,
  status: string,
  extra?: { courier?: string | null; awb?: string | null; tracking_url?: string | null; note?: string | null }
): Promise<EmailResult> {
  const label = STATUS_COPY[status] ?? { title: `Order ${status}`, line: "" };
  const tracking = extra?.awb
    ? `<p style="font-size:13px;color:#56627A;margin:10px 0"><b>Courier:</b> ${escapeHtml(extra.courier || "—")} · <b>AWB:</b> ${escapeHtml(extra.awb)}${extra.tracking_url ? `<br><a href="${extra.tracking_url}" style="color:#4E5BDC">Track parcel →</a>` : ""}</p>`
    : "";
  const html = shell(
    label.title,
    `<p style="font-size:14px;color:#56627A;margin:0 0 8px">Hi ${escapeHtml(order.name || "there")}, ${label.line} <b>${order.id}</b>.</p>
     ${extra?.note ? `<p style="font-size:13px;color:#56627A;margin:0 0 8px">${escapeHtml(extra.note)}</p>` : ""}
     ${tracking}
     ${btn(trackUrl(order), "View order →")}`
  );
  return send(order.email, `Order ${order.id} — ${label.title}`, html);
}

const STATUS_COPY: Record<string, { title: string; line: string }> = {
  confirmed: { title: "Order confirmed", line: "we've confirmed your order" },
  packed: { title: "Order packed", line: "your order is packed and ready to ship —" },
  shipped: { title: "Order shipped 🚚", line: "your order has shipped —" },
  partially_shipped: { title: "Part of your order shipped 🚚", line: "part of your order is on its way —" },
  out_for_delivery: { title: "Out for delivery", line: "your order is out for delivery —" },
  delivered: { title: "Delivered ✅", line: "your order has been delivered —" },
  cancelled: { title: "Order cancelled", line: "your order has been cancelled —" },
};
