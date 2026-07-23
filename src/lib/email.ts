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
// Every customer-facing email is BCC'd here so the business inbox holds a
// copy of exactly what each customer was told (audit trail + quick replies).
const BCC_SELF = (process.env.ORDER_BCC_EMAIL ?? "info@elumenuvo.com").trim();
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

async function send(to: string, subject: string, html: string, opts?: { bcc?: string; scheduledAt?: string }): Promise<EmailResult> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    console.log(`[email] RESEND_API_KEY unset — skipped "${subject}" → ${to}`);
    return { ok: false, skipped: true };
  }
  try {
    // Never BCC an address to itself (Resend dedupes, but keep it clean).
    const bcc = opts?.bcc && opts.bcc.toLowerCase() !== to.toLowerCase() ? [opts.bcc] : undefined;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html, ...(bcc ? { bcc } : {}), ...(opts?.scheduledAt ? { scheduled_at: opts.scheduledAt } : {}) }),
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

/** Tag an email link so the visit attributes to the email that drove it
 *  (analytics reads utm_source/campaign on landing). Hash-fragment safe. */
function withUtm(url: string, campaign: string): string {
  const [base, hash] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}utm_source=email&utm_medium=email&utm_campaign=${encodeURIComponent(campaign)}${hash ? `#${hash}` : ""}`;
}

export function trackUrl(order: OrderLike, campaign = "order-email"): string {
  return withUtm(`${SITE}/track?order=${encodeURIComponent(order.id)}&email=${encodeURIComponent(order.email)}`, campaign);
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
     ${btn(trackUrl(order, "order-confirmed"), "Track my order →")}`
  );
  return send(order.email, `Order ${order.id} confirmed`, html, { bcc: BCC_SELF });
}

/** Notify the customer their order status changed (optionally with tracking). */
export async function sendCustomerStatusUpdate(
  order: OrderLike,
  status: string,
  extra?: { courier?: string | null; awb?: string | null; tracking_url?: string | null; note?: string | null }
): Promise<EmailResult> {
  const label = STATUS_COPY[status] ?? { title: `Order ${status}`, line: "" };
  const tracking = extra?.awb
    ? `<p style="font-size:13px;color:#56627A;margin:10px 0"><b>Courier:</b> ${escapeHtml(extra.courier || "—")} · <b>AWB:</b> ${escapeHtml(extra.awb)}${extra.tracking_url && /^https?:\/\//i.test(extra.tracking_url) ? `<br><a href="${escapeHtml(extra.tracking_url)}" style="color:#4E5BDC">Track parcel →</a>` : ""}</p>`
    : "";
  const html = shell(
    label.title,
    `<p style="font-size:14px;color:#56627A;margin:0 0 8px">Hi ${escapeHtml(order.name || "there")}, ${label.line} <b>${order.id}</b>.</p>
     ${extra?.note ? `<p style="font-size:13px;color:#56627A;margin:0 0 8px">${escapeHtml(extra.note)}</p>` : ""}
     ${itemsTable(order)}
     ${tracking}
     ${btn(trackUrl(order, `order-${status}`), "View order →")}
     ${status === "delivered" ? reviewAsk(order) : ""}`
  );
  return send(order.email, `Order ${order.id} — ${label.title}`, html, { bcc: BCC_SELF });
}

/** Post-delivery review request: reviews are purchase-verified (order ID +
 *  email checked in the database), so we hand the customer both up front.
 *  Real reviews also light up star ratings on Google for that product. */
function reviewAsk(order: OrderLike): string {
  const items = (order.items ?? []).slice(0, 3);
  const links = items
    .map((i: any) => i.id ? `<a href="${withUtm(`${SITE}/catalogue/${encodeURIComponent(i.id)}#reviews`, "review-request")}" style="color:#4E5BDC;font-weight:600">${escapeHtml(String(i.name ?? i.id))}</a>` : escapeHtml(String(i.name ?? "")))
    .filter(Boolean)
    .join("<br>");
  return `
    <div style="margin-top:22px;padding:16px 18px;background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px">
      <p style="font-size:13.5px;color:#19202E;font-weight:700;margin:0 0 6px">How did we do? ⚡</p>
      <p style="font-size:13px;color:#56627A;margin:0 0 10px">
        A 1-minute review helps other electricians and builders buy with confidence.
        Use order ID <b>${escapeHtml(order.id)}</b> and this email address on the review form.
      </p>
      ${links ? `<p style="font-size:13px;margin:0">${links}</p>` : ""}
    </div>`;
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

/** Scheduled 35 minutes after signup: nudge an unconfirmed account to finish.
 *  Resend delivers it at scheduled_at; if they confirm in the meantime the
 *  copy makes it harmless. */
export async function sendConfirmReminder(email: string, name?: string | null): Promise<EmailResult> {
  const when = new Date(Date.now() + 35 * 60_000).toISOString();
  const html = shell(
    "One tap left on your Elume account",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(name || "there")}, you created an Elume account a little while ago but the email isn't confirmed yet.</p>
     <p style="font-size:13.5px;color:#56627A;margin:0 0 10px">Find the email from <b>info@elumenuvo.com</b> titled "Confirm your email" (check spam too) and tap the button inside. That's it — you can then sign in and see your orders.</p>
     ${btn(withUtm(`${SITE}/signin`, "confirm-reminder"), "Go to sign in →")}
     <p style="font-size:12px;color:#8A93A6;margin:14px 0 0">Already confirmed? You're all set — ignore this.</p>`
  );
  return send(email, "Reminder: confirm your Elume email", html, { bcc: BCC_SELF, scheduledAt: when });
}

/** Invite a guest-checkout customer to create an account so they can track
 *  their order from a dashboard (signup link arrives pre-filled). */
export async function sendAccountInvite(order: OrderLike): Promise<EmailResult> {
  const signupUrl = withUtm(`${SITE}/signin?mode=signup&email=${encodeURIComponent(order.email)}`, "account-invite");
  const html = shell(
    "Track your order from your own dashboard",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, thanks for your order <b>${order.id}</b>!</p>
     <p style="font-size:13.5px;color:#56627A;margin:0 0 12px">Create your free Elume account with this same email and the order appears in your dashboard automatically — live delivery tracking, order history and GST invoices in one place.</p>
     ${btn(signupUrl, "Create my account →")}
     <p style="font-size:12px;color:#8A93A6;margin:14px 0 0">Prefer not to? No problem — you can always track with just your order number at ${SITE}/track</p>`
  );
  return send(order.email, `Track order ${order.id} — create your Elume account`, html, { bcc: BCC_SELF });
}

/** Order confirmation restated + account nudge + a personal one-time
 *  discount code for the next purchase. Sent manually from admin. */
export async function sendWelcomeOffer(order: OrderLike, code: string, percent: number, expiresAt: Date): Promise<EmailResult> {
  const signupUrl = withUtm(`${SITE}/signin?mode=signup&email=${encodeURIComponent(order.email)}`, "welcome-offer");
  const until = expiresAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long" });
  const html = shell(
    "Your order is confirmed — and a welcome gift 🎁",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, your order <b>${order.id}</b> is confirmed and being prepared.</p>
     ${itemsTable(order)}
     <p style="font-size:13px;color:#56627A;margin:12px 0 4px">Track it anytime:</p>
     ${btn(trackUrl(order, "welcome-offer"), "Track my order →")}

     <div style="margin-top:24px;padding:18px 20px;background:linear-gradient(120deg,#F2FBF6,#EEF0FD);border:1px solid #DCEDE3;border-radius:12px">
       <p style="font-size:13.5px;font-weight:700;color:#19202E;margin:0 0 6px">As a new Elume customer, here's ${percent}% off your next order:</p>
       <p style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:1px;color:#1F9D63;margin:0 0 6px">${escapeHtml(code)}</p>
       <p style="font-size:12px;color:#56627A;margin:0">One-time use, tied to this email, valid until <b>${until}</b>. Enter it in the "Discount code" box at checkout.</p>
     </div>

     <div style="margin-top:18px;padding:16px 18px;background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px">
       <p style="font-size:13.5px;font-weight:700;color:#19202E;margin:0 0 6px">See your orders in one place</p>
       <p style="font-size:13px;color:#56627A;margin:0 0 10px">Create your free account with this email and this order appears in your dashboard automatically — live tracking, history and GST invoices.</p>
       ${btn(signupUrl, "Create my account →")}
     </div>`
  );
  return send(order.email, `Order ${order.id} confirmed — plus ${percent}% off your next order`, html, { bcc: BCC_SELF });
}

/** Item swapped on an order — either at no extra cost (we absorb the
 *  difference) or via a fresh replacement order at current pricing. */
export async function sendReplacementEmail(
  order: OrderLike,
  oldName: string,
  newItem: { name: string; qty: number; price: number },
  mode: "absorbed" | "new-order",
  extra?: { newOrderId?: string; diff?: number }
): Promise<EmailResult> {
  const diffLine =
    mode === "absorbed"
      ? `<p style="font-size:13px;color:#1F9D63;font-weight:600;margin:10px 0 0">No extra charge — we've absorbed any price difference. Your order total stays exactly the same.</p>`
      : `<p style="font-size:13px;color:#56627A;margin:10px 0 0">A replacement order <b>${escapeHtml(extra?.newOrderId ?? "")}</b> has been created at the current price${extra?.diff ? ` (difference of ${fmt(Math.abs(extra.diff))} ${extra.diff > 0 ? "payable — we'll contact you to settle it" : "refundable to you — we'll process it right away"})` : ""}. Your original order stands cancelled.</p>`;
  const html = shell(
    "A small change to your order",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, as discussed — <b>${escapeHtml(oldName)}</b> is discontinued by the manufacturer and no longer available anywhere. On order <b>${order.id}</b> we've replaced it with:</p>
     <div style="background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px;padding:14px 16px">
       <b style="font-size:14px">${escapeHtml(newItem.name)}</b>
       <div style="font-size:13px;color:#56627A;margin-top:4px">Qty ${newItem.qty} · ${fmt(newItem.price)} each</div>
     </div>
     ${diffLine}
     ${btn(trackUrl(order, "order-replacement"), "View my order →")}
     <p style="font-size:12px;color:#8A93A6;margin:16px 0 0">Not happy with the replacement? Reply to this email within 48 hours and we'll refund you in full instead.</p>`
  );
  return send(order.email, `Order ${order.id} — item replaced as discussed`, html, { bcc: BCC_SELF });
}

/** Item refunded (product unavailable, nothing comparable) + a 10% code. */
export async function sendRefundVoucherEmail(
  order: OrderLike,
  itemName: string,
  amount: number,
  code: string,
  expires: Date
): Promise<EmailResult> {
  const until = expires.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long" });
  const html = shell(
    "Refund on its way — and 10% off, on us",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, <b>${escapeHtml(itemName)}</b> from order <b>${order.id}</b> is discontinued by the manufacturer and we couldn't find a fair substitute. We've refunded <b>${fmt(amount)}</b> to your original payment method — it typically lands in 5–7 working days.</p>
     <div style="margin-top:18px;padding:18px 20px;background:linear-gradient(120deg,#F2FBF6,#EEF0FD);border:1px solid #DCEDE3;border-radius:12px">
       <p style="font-size:13.5px;font-weight:700;color:#19202E;margin:0 0 6px">For the trouble — 10% off your next order:</p>
       <p style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:1px;color:#1F9D63;margin:0 0 6px">${escapeHtml(code)}</p>
       <p style="font-size:12px;color:#56627A;margin:0">One-time use, tied to this email, valid until <b>${until}</b>.</p>
     </div>
     ${btn(withUtm(`${SITE}/catalogue`, "refund-voucher"), "Browse the catalogue →")}`
  );
  return send(order.email, `Order ${order.id} — refund of ${fmt(amount)} + 10% off your next order`, html, { bcc: BCC_SELF });
}
