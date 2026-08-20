import { adminClient } from "@/lib/supabase/admin";
import { sendDeliveryDecisionAlert } from "@/lib/email";
import { revalidatePath } from "next/cache";
import DecisionForm from "./DecisionForm";

/**
 * Customer delivery-decision page (migration 0126). The tokened link from
 * the delivery-issue email/WhatsApp lands here: the customer sees what the
 * courier reported, the redelivery pricing (a fee, or free "on us"), and
 * decides on the platform - same address, corrected address, or cancel.
 * Unlisted and unguessable: the token IS the auth, page is noindex.
 */
export const dynamic = "force-dynamic";
export const metadata = { title: "Delivery decision · Elume", robots: { index: false, follow: false } };

async function loadIssue(token: string) {
  const db = adminClient();
  if (!db || !token || token.length < 12) return null;
  const { data: issue } = await db.from("delivery_issues").select("*").eq("decision_token", token).maybeSingle().then((r) => r, () => ({ data: null }));
  if (!issue) return null;
  const { data: order } = await db.from("orders").select("id, name, email, phone, shipping_address, items, total").eq("id", issue.order_id).maybeSingle();
  if (!order) return null;
  return { issue, order };
}

export default async function DeliveryDecisionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await loadIssue(token);

  async function decide(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const db = adminClient();
    if (!db) return { ok: false, error: "Temporarily unavailable - please WhatsApp us." };
    const fresh = await loadIssue(token);
    if (!fresh) return { ok: false, error: "This link is no longer valid." };
    const choice = String(formData.get("choice") ?? "");
    if (!["redeliver", "redeliver_new_address", "cancel_order"].includes(choice)) return { ok: false, error: "Pick an option first." };
    const newAddress = String(formData.get("new_address") ?? "").trim().slice(0, 800);
    if (choice === "redeliver_new_address" && newAddress.length < 20) return { ok: false, error: "Please write the full corrected address (with PIN code)." };
    const note = String(formData.get("note") ?? "").trim().slice(0, 500);

    const { error } = await db.from("delivery_issues").update({
      customer_choice: choice,
      new_address: choice === "redeliver_new_address" ? newAddress : null,
      customer_note: note || null,
      decided_at: new Date().toISOString(),
      status: "customer_decided",
    }).eq("id", fresh.issue.id);
    if (error) return { ok: false, error: "Could not save - please WhatsApp us." };

    const LABEL: Record<string, string> = {
      redeliver: "Customer chose redelivery to the same address",
      redeliver_new_address: "Customer chose redelivery to a corrected address",
      cancel_order: "Customer chose to cancel the order",
    };
    try { await db.from("order_events").insert({ order_id: fresh.order.id, status: "delivery_issue", note: `${LABEL[choice]}${note ? ` · "${note.slice(0, 160)}"` : ""}` }); } catch { /* optional */ }
    try { await sendDeliveryDecisionAlert(fresh.order as any, { choice, newAddress: choice === "redeliver_new_address" ? newAddress : null, note }); } catch { /* best effort */ }
    revalidatePath(`/delivery/${token}`);
    return { ok: true };
  }

  if (!data) {
    return (
      <main style={{ fontFamily: "var(--hanken)", maxWidth: 560, margin: "0 auto", padding: "70px 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 10px" }}>This link is not valid</h1>
        <p style={{ fontSize: 14, color: "#56627A", lineHeight: 1.6 }}>
          It may have expired or already been handled. WhatsApp or email us at info@elumenuvo.com and we will sort your delivery out right away.
        </p>
      </main>
    );
  }

  const { issue, order } = data;
  return (
    <main style={{ fontFamily: "var(--hanken)", maxWidth: 640, margin: "0 auto", padding: "44px 22px 80px", color: "#19202E" }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", color: "#1D2F8A", marginBottom: 8 }}>Elume · delivery update</div>
      <h1 style={{ fontSize: 25, fontWeight: 700, margin: "0 0 8px" }}>We could not deliver order {order.id}</h1>
      <div style={{ background: "#FFF6ED", border: "1px solid #F5DEC4", borderRadius: 12, padding: "12px 16px", fontSize: 14, margin: "0 0 14px" }}>
        <b>What the courier reported:</b> {issue.reason}
      </div>
      <div style={{ fontSize: 14, color: "#56627A", lineHeight: 1.65, marginBottom: 6 }}>
        Address on file:
      </div>
      <div style={{ background: "#F7F8FB", border: "1px solid #E8EBF1", borderRadius: 12, padding: "12px 16px", fontSize: 13.5, whiteSpace: "pre-wrap", marginBottom: 14 }}>
        {order.shipping_address || "-"}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: issue.redelivery_fee > 0 ? "#B7791F" : "#1F9D63", marginBottom: 18 }}>
        {issue.redelivery_fee > 0
          ? `Redelivery charge: ₹${Math.round(Number(issue.redelivery_fee)).toLocaleString("en-IN")}${issue.fee_note ? ` · ${issue.fee_note}` : ""}`
          : `Redelivery is free · ${issue.fee_note || "on us"}`}
      </div>
      <DecisionForm
        decide={decide}
        decided={issue.status === "customer_decided" || issue.status === "redelivery_booked" || issue.status === "resolved"}
        choice={issue.customer_choice}
      />
    </main>
  );
}
