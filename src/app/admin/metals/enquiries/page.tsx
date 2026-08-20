import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Metals enquiry inbox: business-format leads (GSTIN-verified) for the
 * enquiry-only metals (Aluminium, Zinc, Lead, Nickel, MS/TMT, Stainless -
 * and copper bulk deals). Each submission also pings info@ the moment it
 * lands (sendMetalsEnquiryAlert); this page is the source of truth.
 */
export const dynamic = "force-dynamic";

type Enquiry = {
  id: string;
  company: string;
  gstin: string;
  name: string;
  email: string;
  phone: string;
  metal: string;
  message: string;
  created_at: string;
};

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true });

export default async function MetalsEnquiries() {
  await requireAdmin();
  const db = adminClient();

  let rows: Enquiry[] = [];
  if (db) {
    // supabase-js resolves errors into { data: null, error } (it never
    // rejects), so `?? []` alone covers the table-not-yet-created case.
    const { data } = await db
      .from("metal_enquiries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    rows = (data ?? []) as Enquiry[];
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Metals · enquiries</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 13, fontWeight: 600 }}>
          <Link href="/admin/metals" style={{ color: "#1D2F8A" }}>← Price console</Link>
          <a href="/admin/metals/enquiries/export" style={{ color: "#1D2F8A" }}>Download CSV ↓</a>
        </div>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 22px" }}>
        {rows.length} enquir{rows.length === 1 ? "y" : "ies"} · every submission is GSTIN-validated and also emailed to info@elumenuvo.com.
      </p>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "22px 24px", fontSize: 14, color: "#56627A" }}>
          No enquiries yet. They'll appear here (and in the info@ inbox) as soon as the public metals enquiry form goes live.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((e) => (
            <div key={e.id} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{e.company}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1D2F8A", background: "#EEF0FD", borderRadius: 7, padding: "2px 8px" }}>{e.metal}</span>
                  <span style={{ fontSize: 12, fontFamily: "var(--mono, monospace)", color: "#56627A" }}>GSTIN {e.gstin}</span>
                </div>
                <span style={{ fontSize: 12, color: "#8A93A6" }}>{IST.format(new Date(e.created_at))} IST</span>
              </div>
              <div style={{ fontSize: 13, color: "#56627A", margin: "6px 0 10px" }}>
                {e.name} · <a href={`mailto:${e.email}`} style={{ color: "#1D2F8A" }}>{e.email}</a> · <a href={`tel:${e.phone}`} style={{ color: "#1D2F8A" }}>{e.phone}</a>
              </div>
              <div style={{ fontSize: 13.5, color: "#19202E", whiteSpace: "pre-wrap", background: "#F7F8FB", border: "1px solid #F0F2F6", borderRadius: 10, padding: "10px 14px" }}>{e.message}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
