/**
 * Transactional email via the Resend REST API (no SDK dependency). Server-only.
 * Graceful: if RESEND_API_KEY is unset it logs and no-ops - order placement and
 * status changes must never fail because email is down.
 *
 * Env:
 *   RESEND_API_KEY        - Resend key (server secret; enables sending)
 *   ORDER_FROM_EMAIL      - verified sender, e.g. "Elume <info@elumenuvo.com>"
 *   ADMIN_EMAIL           - where new-order alerts go (default divye2014@gmail.com)
 *   NEXT_PUBLIC_SITE_URL  - base for tracking links (default https://elumenuvo.com)
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
  shipping_fee?: number | null;
  gstin?: string | null;
};

async function send(to: string, subject: string, html: string, opts?: { bcc?: string; scheduledAt?: string }): Promise<EmailResult> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    console.log(`[email] RESEND_API_KEY unset - skipped "${subject}" → ${to}`);
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
  // Shipping gets its own line whenever it was charged, so the item lines
  // plus shipping visibly add up to the total that hit the card.
  const ship = Number(order.shipping_fee ?? 0);
  return `<table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:8px 0">${rows}
    ${ship > 0 ? `<tr><td style="padding:6px 0;color:#56627A">Delivery</td><td style="padding:6px 0;text-align:right;font-weight:600">${fmt(ship)}</td></tr>` : ""}
    ${order.total != null ? `<tr><td style="padding:10px 0 0;border-top:1px solid #F0F2F6;font-weight:700">Total${ship === 0 ? " · free delivery" : ""}</td><td style="padding:10px 0 0;border-top:1px solid #F0F2F6;text-align:right;font-weight:700">${fmt(order.total)}</td></tr>` : ""}
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
  return send(ADMIN_EMAIL, `🛒 New order ${order.id} - ${order.total != null ? fmt(order.total) : ""}`, html);
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
    ? `<p style="font-size:13px;color:#56627A;margin:10px 0"><b>Courier:</b> ${escapeHtml(extra.courier || "-")} · <b>AWB:</b> ${escapeHtml(extra.awb)}${extra.tracking_url && /^https?:\/\//i.test(extra.tracking_url) ? `<br><a href="${escapeHtml(extra.tracking_url)}" style="color:#4E5BDC">Track parcel →</a>` : ""}</p>`
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
  return send(order.email, `Order ${order.id} - ${label.title}`, html, { bcc: BCC_SELF });
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
  packed: { title: "Order packed", line: "your order is packed and ready to ship -" },
  shipped: { title: "Order shipped 🚚", line: "your order has shipped -" },
  partially_shipped: { title: "Part of your order shipped 🚚", line: "part of your order is on its way -" },
  out_for_delivery: { title: "Out for delivery", line: "your order is out for delivery -" },
  delivered: { title: "Delivered ✅", line: "your order has been delivered -" },
  cancelled: { title: "Order cancelled", line: "your order has been cancelled -" },
};

/** Scheduled 35 minutes after signup: nudge an unconfirmed account to finish.
 *  Resend delivers it at scheduled_at; if they confirm in the meantime the
 *  copy makes it harmless. */
export async function sendConfirmReminder(email: string, name?: string | null): Promise<EmailResult> {
  const when = new Date(Date.now() + 35 * 60_000).toISOString();
  const html = shell(
    "One tap left on your Elume account",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(name || "there")}, you created an Elume account a little while ago but the email isn't confirmed yet.</p>
     <p style="font-size:13.5px;color:#56627A;margin:0 0 10px">Find the email from <b>info@elumenuvo.com</b> titled "Confirm your email" (check spam too) and tap the button inside. That's it - you can then sign in and see your orders.</p>
     ${btn(withUtm(`${SITE}/signin`, "confirm-reminder"), "Go to sign in →")}
     <p style="font-size:12px;color:#8A93A6;margin:14px 0 0">Already confirmed? You're all set - ignore this.</p>`
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
     <p style="font-size:13.5px;color:#56627A;margin:0 0 12px">Create your free Elume account with this same email and the order appears in your dashboard automatically - live delivery tracking, order history and GST invoices in one place.</p>
     ${btn(signupUrl, "Create my account →")}
     <p style="font-size:12px;color:#8A93A6;margin:14px 0 0">Prefer not to? No problem - you can always track with just your order number at ${SITE}/track</p>`
  );
  return send(order.email, `Track order ${order.id} - create your Elume account`, html, { bcc: BCC_SELF });
}

/** Order confirmation restated + account nudge + a personal one-time
 *  discount code for the next purchase. Sent manually from admin. */
export async function sendWelcomeOffer(order: OrderLike, code: string, percent: number, expiresAt: Date): Promise<EmailResult> {
  const signupUrl = withUtm(`${SITE}/signin?mode=signup&email=${encodeURIComponent(order.email)}`, "welcome-offer");
  const until = expiresAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long" });
  const html = shell(
    "Your order is confirmed - and a welcome gift 🎁",
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
       <p style="font-size:13px;color:#56627A;margin:0 0 10px">Create your free account with this email and this order appears in your dashboard automatically - live tracking, history and GST invoices.</p>
       ${btn(signupUrl, "Create my account →")}
     </div>`
  );
  return send(order.email, `Order ${order.id} confirmed - plus ${percent}% off your next order`, html, { bcc: BCC_SELF });
}

/** Item swapped on an order - either at no extra cost (we absorb the
 *  difference) or via a fresh replacement order at current pricing. */
export async function sendReplacementEmail(
  order: OrderLike,
  oldName: string,
  newItem: { name: string; qty: number; price: number },
  mode: "absorbed" | "new-order",
  extra?: { newOrderId?: string; diff?: number; listPrice?: number }
): Promise<EmailResult> {
  // Only claim to have absorbed a difference when the replacement genuinely
  // costs MORE. When it lists for less and the bill is being kept as paid,
  // say plainly that the total is unchanged - never dress it up as a saving.
  const absorbed = extra?.listPrice != null && extra.listPrice > newItem.price;
  const diffLine =
    mode === "absorbed"
      ? absorbed
        ? `<p style="font-size:13px;color:#1F9D63;font-weight:600;margin:10px 0 0">No extra charge - the replacement lists higher and we've absorbed the difference. Your order total stays exactly the same.</p>`
        : `<p style="font-size:13px;color:#56627A;margin:10px 0 0">Your order total is unchanged at <b>${fmt(Number(order.total ?? 0))}</b>, as agreed. Nothing more to pay.</p>`
      : `<p style="font-size:13px;color:#56627A;margin:10px 0 0">A replacement order <b>${escapeHtml(extra?.newOrderId ?? "")}</b> has been created at the current price${extra?.diff ? ` (difference of ${fmt(Math.abs(extra.diff))} ${extra.diff > 0 ? "payable - we'll contact you to settle it" : "refundable to you - we'll process it right away"})` : ""}. Your original order stands cancelled.</p>`;
  const html = shell(
    "A small change to your order",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, as discussed - <b>${escapeHtml(oldName)}</b> is discontinued by the manufacturer and no longer available anywhere. On order <b>${order.id}</b> we've replaced it with:</p>
     <div style="background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px;padding:14px 16px">
       <b style="font-size:14px">${escapeHtml(newItem.name)}</b>
       <div style="font-size:13px;color:#56627A;margin-top:4px">Qty ${newItem.qty} · ${fmt(newItem.price)} each</div>
     </div>
     ${diffLine}
     ${btn(trackUrl(order, "order-replacement"), "View my order →")}
     <p style="font-size:12px;color:#8A93A6;margin:16px 0 0">Not happy with the replacement? Reply to this email within 48 hours and we'll refund you in full instead.</p>`
  );
  return send(order.email, `Order ${order.id} - item replaced as discussed`, html, { bcc: BCC_SELF });
}

/** Refund receipt: sent when the admin issues a Razorpay refund on an order.
 *  Shows the money, the Razorpay reference the customer can quote to their
 *  bank, and the honest timeline. */
export async function sendRefundReceiptEmail(
  order: OrderLike,
  o: { amount: number; refundId: string; paymentId: string; reason?: string; partial: boolean }
): Promise<EmailResult> {
  const issued = new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric" });
  const row = (k: string, v: string) =>
    `<tr><td style="padding:7px 0;font-size:13px;color:#56627A">${k}</td><td style="padding:7px 0;font-size:13px;color:#19202E;font-weight:600;text-align:right">${v}</td></tr>`;
  const html = shell(
    o.partial ? "Refund issued on your order" : "Your order has been refunded",
    `<p style="font-size:14px;color:#56627A;margin:0 0 14px">Hi ${escapeHtml(order.name || "there")}, we&apos;ve issued a refund on order <b>${order.id}</b>. It goes back to the payment method you paid with - no action needed from you.</p>
     <div style="background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px;padding:6px 18px">
       <table style="width:100%;border-collapse:collapse">
         ${row("Order", String(order.id))}
         ${row("Amount refunded", fmt(o.amount))}
         ${row("Refund reference", `<span style=\"font-family:monospace\">${escapeHtml(o.refundId)}</span>`)}
         ${row("Payment reference", `<span style=\"font-family:monospace\">${escapeHtml(o.paymentId)}</span>`)}
         ${row("Issued on", issued)}
       </table>
     </div>
     ${o.reason ? `<p style="font-size:13px;color:#56627A;margin:14px 0 0"><b>Why:</b> ${escapeHtml(o.reason)}</p>` : ""}
     <p style="font-size:13px;color:#56627A;margin:14px 0 0">
       Refunds typically reach your account in <b>5&#8211;7 working days</b> (UPI is often same-day; cards depend on your bank).
       If it takes longer, quote the refund reference above to your bank - or just reply to this email and we&apos;ll chase it with Razorpay for you.
     </p>
     ${o.partial ? `<p style="font-size:12.5px;color:#8A93A6;margin:14px 0 0">This is a partial refund - the rest of your order is unaffected.</p>` : ""}
     ${btn(trackUrl(order, "refund-receipt"), "View my order &#8594;")}`
  );
  return send(order.email, `Refund of ${fmt(o.amount)} issued &#183; order ${order.id}`, html, { bcc: BCC_SELF });
}

/** Ping the business inbox (info@) the moment a trade-survey response lands.
 *  The response itself lives in trade_survey (admin → Leads → Trade survey);
 *  this email just makes sure nothing sits unread. Graceful no-op without
 *  RESEND_API_KEY - the admin tab stays the source of truth either way. */
export async function sendTradeSurveyAlert(s: {
  company: string; phone: string; buys?: string | null; channel?: string | null; priority?: string | null; missing?: string | null;
}): Promise<EmailResult> {
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td style="padding:6px 0;font-size:13px;color:#56627A;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0 6px 14px;font-size:13px;color:#19202E">${escapeHtml(v)}</td></tr>` : "";
  const html = shell(
    "New trade survey response",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px"><b>${escapeHtml(s.company)}</b> · ${escapeHtml(s.phone)}</p>
     <table style="width:100%;border-collapse:collapse">
       ${row("Buys most often", s.buys)}
       ${row("Buys today via", s.channel)}
       ${row("What matters", s.priority)}
       ${row("What's missing", s.missing)}
     </table>
     ${btn(`${SITE}/admin/leads?tab=survey`, "All responses in admin →")}`
  );
  return send(BCC_SELF, `📋 Trade survey · ${s.company}`, html);
}

/** Copper booking confirmed: the 5% token landed, the rate is locked, and
 *  the balance settles by RTGS. Bank details come from the metals_bank
 *  content block; until the admin fills it, a details-follow line shows. */
export async function sendMetalsBookingConfirmation(
  order: OrderLike,
  o: {
    token: number;
    balance: number;
    bank: { account_name?: string; account_number?: string; ifsc?: string; bank?: string; branch?: string; note?: string } | null;
  }
): Promise<EmailResult> {
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td style="padding:6px 0;font-size:13px;color:#56627A;white-space:nowrap">${k}</td><td style="padding:6px 0 6px 14px;font-size:13px;color:#19202E;font-weight:600">${escapeHtml(v)}</td></tr>` : "";
  const bankBlock = o.bank
    ? `<div style="margin-top:16px;padding:16px 18px;background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px">
         <p style="font-size:13.5px;font-weight:700;color:#19202E;margin:0 0 8px">RTGS details for the balance</p>
         <table style="width:100%;border-collapse:collapse">
           ${row("Account name", o.bank.account_name)}
           ${row("Account number", o.bank.account_number)}
           ${row("IFSC", o.bank.ifsc)}
           ${row("Bank", [o.bank.bank, o.bank.branch].filter(Boolean).join(" · "))}
         </table>
         ${o.bank.note ? `<p style="font-size:12px;color:#56627A;margin:8px 0 0">${escapeHtml(o.bank.note)}</p>` : ""}
       </div>`
    : `<p style="font-size:13px;color:#56627A;margin:14px 0 0">Our team will email you the RTGS bank details shortly - the balance is due within <b>2 working days</b> of this booking.</p>`;
  const html = shell(
    "Booking confirmed - rate locked 🔒",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, your token payment is received and today's rate is <b>locked</b> for booking <b>${order.id}</b>.</p>
     ${itemsTable(order)}
     <div style="display:flex;gap:18px;flex-wrap:wrap;background:#E6F5EE;border:1px solid #DCEDE3;border-radius:12px;padding:12px 16px;margin:10px 0 0;font-size:13px">
       <span style="color:#137a4b">Token received <b>${fmt(o.token)}</b></span>
       <span style="color:#19202E">Balance by RTGS <b>${fmt(o.balance)}</b></span>
     </div>
     ${bankBlock}
     <p style="font-size:13px;color:#56627A;margin:14px 0 4px">Material dispatches with a full GST tax invoice once the balance is confirmed. Track anytime:</p>
     ${btn(trackUrl(order, "metals-booking"), "Track my booking →")}`
  );
  return send(order.email, `Booking ${order.id} confirmed · token received, balance by RTGS`, html, { bcc: BCC_SELF });
}

/** Ping the business inbox (info@) the moment a metals enquiry lands. Same
 *  contract as the trade-survey alert: the row in metal_enquiries (admin →
 *  Metals → Enquiries) is the source of truth; this email just makes sure a
 *  GSTIN-verified lead never sits unread. */
export async function sendMetalsEnquiryAlert(e: {
  company: string; gstin: string; name: string; email: string; phone: string; metal: string; message: string;
}): Promise<EmailResult> {
  const row = (k: string, v?: string | null) =>
    v ? `<tr><td style="padding:6px 0;font-size:13px;color:#56627A;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0 6px 14px;font-size:13px;color:#19202E">${escapeHtml(v)}</td></tr>` : "";
  const html = shell(
    `New metals enquiry · ${escapeHtml(e.metal)}`,
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px"><b>${escapeHtml(e.company)}</b> · GSTIN <span style="font-family:monospace">${escapeHtml(e.gstin)}</span></p>
     <table style="width:100%;border-collapse:collapse">
       ${row("Metal", e.metal)}
       ${row("Contact", `${e.name} · ${e.phone}`)}
       ${row("Email", e.email)}
       ${row("Requirement", e.message)}
     </table>
     ${btn(`${SITE}/admin/metals/enquiries`, "All enquiries in admin →")}`
  );
  return send(BCC_SELF, `🔩 Metals enquiry · ${e.metal} · ${e.company}`, html);
}

/** Thrice-daily (9am / 11am / 2pm IST) nudge to update the copper selling
 *  rate. Carries the latest internal MCX + LME reference readings so the
 *  decision can be made straight from the inbox, and deep-links to the
 *  price console. Sent by /api/cron/metals-reminder (GitHub Actions cron). */
export async function sendMetalsPriceReminder(
  slot: string,
  readings: {
    mcx?: { price: number; change: number | null; changePct: number | null; ts: string } | null;
    lme?: { price: number; change: number | null; changePct: number | null; ts: string } | null;
  }
): Promise<EmailResult> {
  const ago = (ts: string) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60_000));
    return mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
  };
  const chip = (change: number | null, pct: number | null) => {
    if (change == null && pct == null) return "";
    const up = (change ?? pct ?? 0) >= 0;
    const txt = `${up ? "▲" : "▼"} ${change != null ? Math.abs(change).toFixed(2) : ""}${pct != null ? ` (${Math.abs(pct).toFixed(2)}%)` : ""}`;
    return `<span style="font-size:12px;font-weight:700;color:${up ? "#1F9D63" : "#D14343"}">${txt}</span>`;
  };
  const card = (label: string, body: string) =>
    `<div style="background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px;padding:14px 16px;margin:0 0 10px">
       <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#8A93A6;margin-bottom:4px">${label}</div>
       ${body}
     </div>`;
  const mcx = readings.mcx
    ? card("MCX Copper · near month", `<span style="font-size:20px;font-weight:700">₹${readings.mcx.price.toFixed(2)}/kg</span> ${chip(readings.mcx.change, readings.mcx.changePct)}<div style="font-size:12px;color:#8A93A6;margin-top:2px">updated ${ago(readings.mcx.ts)}</div>`)
    : card("MCX Copper · near month", `<span style="font-size:13px;color:#8A93A6">No feed data yet - check the console.</span>`);
  const lme = readings.lme
    ? card("LME Copper · 3-month", `<span style="font-size:20px;font-weight:700">$${readings.lme.price.toFixed(2)}/t</span> ${chip(readings.lme.change, readings.lme.changePct)}<div style="font-size:12px;color:#8A93A6;margin-top:2px">updated ${ago(readings.lme.ts)}</div>`)
    : card("LME Copper · 3-month", `<span style="font-size:13px;color:#8A93A6">No feed data yet - check the console.</span>`);
  const html = shell(
    `Copper price update due · ${slot} IST`,
    `<p style="font-size:14px;color:#56627A;margin:0 0 14px">Time for the ${slot} copper rate. Latest internal reference readings:</p>
     ${mcx}${lme}
     ${btn(`${SITE}/admin/metals`, "Open the price console →")}`
  );
  return send(BCC_SELF, `⏰ Copper price update due · ${slot} IST`, html);
}

/** Nudge a business that has been buying as a guest (they gave a GSTIN at
 *  checkout but never opened an account) to switch to a business account.
 *  The pitch is what they gain, not what we gain. */
export async function sendBusinessAccountNudge(to: {
  email: string; name?: string | null; gstin: string; orders: number;
}): Promise<EmailResult> {
  const signupUrl = withUtm(`${SITE}/signin?mode=signup&email=${encodeURIComponent(to.email)}`, "business-nudge");
  const html = shell(
    "Your GST details, filled in for you next time",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(to.name || "there")}, thanks for buying from Elume.</p>
     <p style="font-size:13.5px;color:#56627A;margin:0 0 12px">
       You have been entering GSTIN <b style="font-family:monospace">${escapeHtml(to.gstin)}</b> by hand at checkout${to.orders > 1 ? ` across ${to.orders} orders` : ""}.
       A free business account puts it on every invoice automatically, so you never type it again.
     </p>
     <div style="background:#F7F8FB;border:1px solid #E8EBF1;border-radius:12px;padding:14px 18px;margin:0 0 16px">
       <p style="font-size:13px;color:#19202E;font-weight:700;margin:0 0 8px">What changes</p>
       <p style="font-size:13px;color:#56627A;margin:0 0 6px">· GST invoice with your GSTIN on every order, automatically</p>
       <p style="font-size:13px;color:#56627A;margin:0 0 6px">· Saved sites and addresses, so repeat deliveries take three clicks</p>
       <p style="font-size:13px;color:#56627A;margin:0 0 6px">· Every past and future order in one place, with live tracking</p>
       <p style="font-size:13px;color:#56627A;margin:0">· Wholesale pricing applies automatically at 15+ units</p>
     </div>
     <p style="font-size:13px;color:#56627A;margin:0 0 4px">It takes about a minute, and your existing orders attach to it automatically:</p>
     ${btn(signupUrl, "Open my business account →")}
     <p style="font-size:12px;color:#8A93A6;margin:16px 0 0">Happy as you are? Nothing changes, and you can keep checking out as a guest.</p>`
  );
  return send(to.email, "Stop typing your GSTIN at checkout", html, { bcc: BCC_SELF });
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
    "Refund on its way - and 10% off, on us",
    `<p style="font-size:14px;color:#56627A;margin:0 0 10px">Hi ${escapeHtml(order.name || "there")}, <b>${escapeHtml(itemName)}</b> from order <b>${order.id}</b> is discontinued by the manufacturer and we couldn't find a fair substitute. We've refunded <b>${fmt(amount)}</b> to your original payment method - it typically lands in 5–7 working days.</p>
     <div style="margin-top:18px;padding:18px 20px;background:linear-gradient(120deg,#F2FBF6,#EEF0FD);border:1px solid #DCEDE3;border-radius:12px">
       <p style="font-size:13.5px;font-weight:700;color:#19202E;margin:0 0 6px">For the trouble - 10% off your next order:</p>
       <p style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:1px;color:#1F9D63;margin:0 0 6px">${escapeHtml(code)}</p>
       <p style="font-size:12px;color:#56627A;margin:0">One-time use, tied to this email, valid until <b>${until}</b>.</p>
     </div>
     ${btn(withUtm(`${SITE}/catalogue`, "refund-voucher"), "Browse the catalogue →")}`
  );
  return send(order.email, `Order ${order.id} - refund of ${fmt(amount)} + 10% off your next order`, html, { bcc: BCC_SELF });
}
