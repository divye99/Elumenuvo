import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Every lead the site captures, in one console:
 *   credit    — NBFC credit waitlist signups (waitlist table)
 *   sellers   — "Sell on Elume" partner leads (partner_leads, kind=seller)
 *   requests  — product sourcing requests (partner_leads, kind=product-request)
 *   business  — business account signups (profiles, account_type=business)
 * Each tab is exportable as CSV via /admin/leads/export.
 */

type Row = Record<string, any>;

async function load() {
  const db = adminClient();
  if (!db) return { credit: [], sellers: [], requests: [], business: [] };
  const [w, p, b] = await Promise.all([
    db.from("waitlist").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("partner_leads").select("*").order("created_at", { ascending: false }).limit(500),
    db.from("profiles").select("*").eq("account_type", "business").order("updated_at", { ascending: false }).limit(500),
  ]);
  const leads = (p.data ?? []) as Row[];
  return {
    credit: (w.data ?? []) as Row[],
    sellers: leads.filter((l) => l.kind === "seller"),
    requests: leads.filter((l) => l.kind !== "seller"),
    business: (b.data ?? []) as Row[],
  };
}

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab = "credit" } = await searchParams;
  const data = await load();

  const tabs: [string, string, number][] = [
    ["credit", "Credit waitlist", data.credit.length],
    ["business", "Business accounts", data.business.length],
    ["sellers", "Sell on Elume", data.sellers.length],
    ["requests", "Product requests", data.requests.length],
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
          <Link key={key} href={`/admin/leads?tab=${key}`} style={{ fontSize: 13, fontWeight: 600, padding: "6px 13px", borderRadius: 8, background: tab === key ? "#161D2B" : "#fff", color: tab === key ? "#fff" : "#56627A", border: "1px solid #E8EBF1" }}>
            {label} <span style={{ opacity: 0.7 }}>{count}</span>
          </Link>
        ))}
        <a href={`/admin/leads/export?tab=${tab}`} style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#4E5BDC" }}>⬇ Export CSV</a>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No entries yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          {rows.map((r, i) => (
            <div key={r.id ?? i} style={{ padding: "13px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>
                  {r.name ?? r.full_name ?? "–"}
                  {r.company && <span style={{ fontWeight: 500, color: "#56627A" }}> · {r.company}</span>}
                </div>
                <div style={{ fontSize: 12, color: "#4E5BDC" }}>{r.email ?? "email via account"}{r.phone ? ` · ${r.phone}` : ""}</div>
              </div>
              {tab === "business" && (
                <div style={{ fontSize: 12, color: "#56627A" }}>
                  GSTIN <b style={{ fontFamily: "var(--space-mono)" }}>{r.gstin ?? "–"}</b>{r.business_type ? ` · ${r.business_type}` : ""}
                </div>
              )}
              {r.message && <div style={{ fontSize: 12.5, color: "#56627A", flex: "1 1 260px" }}>{String(r.message).slice(0, 240)}</div>}
              {r.details && Object.keys(r.details).length > 0 && (
                <div style={{ fontSize: 11.5, color: "#8A93A6", flex: "1 1 220px" }}>
                  {Object.entries(r.details as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(" · ").slice(0, 220)}
                </div>
              )}
              <div style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap" }}>{dt(r.created_at ?? r.updated_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
