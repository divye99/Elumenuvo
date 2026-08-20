import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { istDateTime } from "@/lib/admin/ist";
import { inspectGstin } from "@/lib/gstin";
import GuestBizTable from "./GuestBizTable";

export const dynamic = "force-dynamic";

/**
 * Every lead the site captures, in one console:
 *   credit    - NBFC credit waitlist signups (waitlist table)
 *   sellers   - "Sell on Elume" partner leads (partner_leads, kind=seller)
 *   requests  - product sourcing requests (partner_leads, kind=product-request)
 *   business  - business account signups (profiles, account_type=business)
 *   survey    - trade outreach survey responses (trade_survey; also emailed
 *               to info@ on arrival via sendTradeSurveyAlert)
 * Each tab is exportable as CSV via /admin/leads/export.
 */

type Row = Record<string, any>;

/**
 * Businesses buying WITHOUT a business account: they gave a GSTIN at checkout
 * but never signed up, so they get no GST-invoice defaults, no saved sites and
 * no order history. Each row is a nudge worth sending. Grouped by GSTIN so a
 * repeat buyer appears once, with their order count.
 */
type GuestBiz = {
  gstin: string; name: string; email: string; phone: string | null;
  orders: number; paidOrders: number; lastAt: string; state?: string; hasAccount: boolean;
};

async function guestBusinesses(db: NonNullable<ReturnType<typeof adminClient>>): Promise<GuestBiz[]> {
  const { data: orders } = await db
    .from("orders")
    .select("gstin, name, email, phone, status, created_at, user_id")
    .not("gstin", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (!orders?.length) return [];

  // Anyone who already has a business profile is not a lead.
  const { data: profs } = await db.from("profiles").select("gstin").eq("account_type", "business");
  const claimed = new Set((profs ?? []).map((p) => String(p.gstin ?? "").toUpperCase()).filter(Boolean));

  const by = new Map<string, GuestBiz>();
  for (const o of orders) {
    const g = String(o.gstin ?? "").toUpperCase();
    if (!g || claimed.has(g)) continue;
    const hit = by.get(g);
    if (hit) {
      hit.orders += 1;
      if (PAID_STATES.has(String(o.status))) hit.paidOrders += 1;
      if (o.user_id) hit.hasAccount = true;
      continue;
    }
    by.set(g, {
      gstin: g, name: o.name ?? "", email: o.email ?? "", phone: o.phone ?? null,
      orders: 1, paidOrders: PAID_STATES.has(String(o.status)) ? 1 : 0,
      lastAt: o.created_at, state: inspectGstin(g).state, hasAccount: !!o.user_id,
    });
  }
  // Most valuable first: real buyers before abandoned carts.
  return [...by.values()].sort((a, b) => b.paidOrders - a.paidOrders || b.orders - a.orders || (a.lastAt < b.lastAt ? 1 : -1));
}

const PAID_STATES = new Set(["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered"]);

async function load() {
  const db = adminClient();
  if (!db) return { credit: [], sellers: [], requests: [], metalsdata: [], business: [], survey: [], guestbiz: [] as GuestBiz[] };
  const [w, p, b, ts] = await Promise.all([
    db.from("waitlist").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("partner_leads").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("*").eq("account_type", "business").order("updated_at", { ascending: false }).limit(500),
    db.from("trade_survey").select("*").order("created_at", { ascending: false }).limit(500).then((r) => r, () => ({ data: [] })),
  ]);
  const leads = (p.data ?? []) as Row[];
  return {
    credit: (w.data ?? []) as Row[],
    sellers: leads.filter((l) => l.kind === "seller"),
    requests: leads.filter((l) => l.kind !== "seller" && l.kind !== "metals-data"),
    metalsdata: leads.filter((l) => l.kind === "metals-data"),
    business: (b.data ?? []) as Row[],
    survey: ((ts as { data?: Row[] | null }).data ?? []) as Row[],
    guestbiz: await guestBusinesses(db),
  };
}


export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "credit" } = await searchParams;
  const data = await load();

  const tabs: [string, string, number][] = [
    ["credit", "Credit waitlist", data.credit.length],
    ["business", "Business accounts", data.business.length],
    ["sellers", "Sell on Elume", data.sellers.length],
    ["requests", "Product requests", data.requests.length],
    ["metalsdata", "Metals data", data.metalsdata.length],
    ["survey", "Trade survey", data.survey.length],
    ["guestbiz", "Business, no account", data.guestbiz.length],
  ];

  const rows: Row[] = (data as any)[tab] ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Leads</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>
        Everyone who has raised a hand: waitlist, business signups, seller applications and sourcing requests.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {tabs.map(([key, label, count]) => (
          <Link key={key} href={`/admin/leads?tab=${key}`} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: tab === key ? "#16215B" : "#fff", color: tab === key ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
            {label} <span style={{ opacity: 0.7 }}>{count}</span>
          </Link>
        ))}
        <a href={`/admin/leads/export?tab=${tab}`} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#1D2F8A" }}>⬇ Export CSV</a>
      </div>

      {tab === "guestbiz" ? (
        <GuestBizTable rows={data.guestbiz} />
      ) : rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No entries yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          {rows.map((r, i) => (
            <div key={r.id ?? i} style={{ padding: "13px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>
                  {r.name ?? r.full_name ?? r.company ?? "–"}
                  {r.company && (r.name || r.full_name) && <span style={{ fontWeight: 500, color: "#56627A" }}> · {r.company}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#1D2F8A" }}>{r.email ?? (tab === "survey" ? "" : "email via account")}{r.phone ? `${r.email || tab !== "survey" ? " · " : ""}${r.phone}` : ""}</div>
              </div>
              {tab === "business" && (
                <div style={{ fontSize: 12, color: "#56627A" }}>
                  GSTIN <b style={{ fontFamily: "var(--space-mono)" }}>{r.gstin ?? "–"}</b>{r.business_type ? ` · ${r.business_type}` : ""}
                </div>
              )}
              {tab === "survey" && (
                <div style={{ fontSize: 12.5, color: "#56627A", flex: "1 1 340px", display: "flex", flexDirection: "column", gap: 3 }}>
                  {r.buys && <div><b style={{ color: "#19202E" }}>Buys:</b> {r.buys}</div>}
                  {r.channel && <div><b style={{ color: "#19202E" }}>Channel:</b> {r.channel}</div>}
                  {r.priority && <div><b style={{ color: "#19202E" }}>Priority:</b> {r.priority}</div>}
                  {r.missing && <div><b style={{ color: "#19202E" }}>Missing:</b> {String(r.missing).slice(0, 400)}</div>}
                </div>
              )}
              {r.message && <div style={{ fontSize: 12.5, color: "#56627A", flex: "1 1 260px" }}>{String(r.message).slice(0, 240)}</div>}
              {r.details && Object.keys(r.details).length > 0 && (
                <div style={{ fontSize: 11.5, color: "#8A93A6", flex: "1 1 220px" }}>
                  {Object.entries(r.details as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 220)}
                </div>
              )}
              <div style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap" }}>{istDateTime(r.created_at ?? r.updated_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
