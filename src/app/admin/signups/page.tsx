import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { loadSignups } from "@/lib/admin/signups-data";

export const dynamic = "force-dynamic";

/** Every registered account: who signed up, when, whether they confirmed
 *  their email, when they last signed in, and their profile (business
 *  accounts show company + GSTIN). Exportable as CSV. */

const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–");

export default async function AdminSignups() {
  await requireAdmin();
  const signups = await loadSignups();
  const business = signups.filter((s) => s.account_type === "business").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Signups</h1>
        <Link href="/admin" style={{ fontSize: 13, color: "#8A93A6" }}>← Dashboard</Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>
        {signups.length} registered account{signups.length === 1 ? "" : "s"} · {business} business ·{" "}
        {signups.filter((s) => !s.confirmed).length} unconfirmed
        <a href="/admin/signups/export" style={{ marginLeft: 14, fontWeight: 700, color: "#4E5BDC" }}>⬇ Export CSV</a>
      </p>

      {signups.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          No accounts yet.
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          {signups.map((s, i) => (
            <div key={s.id} style={{ padding: "13px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ minWidth: 240 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>
                  {s.name ?? "–"}
                  {s.account_type === "business" && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "#4E5BDC", background: "#EEF0FE", padding: "2px 8px", borderRadius: 7, textTransform: "uppercase" }}>Business</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#4E5BDC" }}>{s.email}{s.phone ? ` · ${s.phone}` : ""}</div>
              </div>
              {s.company && (
                <div style={{ fontSize: 12, color: "#56627A" }}>
                  {s.company}{s.gstin ? <> · GSTIN <b style={{ fontFamily: "var(--space-mono)" }}>{s.gstin}</b></> : ""}
                </div>
              )}
              {!s.confirmed && (
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#C77700", background: "#FFF3E0", padding: "2px 8px", borderRadius: 7 }}>email unconfirmed</span>
              )}
              <div style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap", textAlign: "right" }}>
                <div>joined {dt(s.created_at)}</div>
                <div>last seen {dt(s.last_sign_in_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
