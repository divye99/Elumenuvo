import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/auth";
import { loadHealthSummary, SLOW_DB_MS, SLOW_PAGE_MS, RECOVERY_GAP_MS, type HealthRow } from "@/lib/health";
import HealthCheckNow from "@/components/admin/HealthCheckNow";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site health", robots: { index: false } };

const COLOR: Record<HealthRow["status"], string> = { ok: "#1F9D63", slow: "#D98A12", down: "#C62828" };
const LABEL: Record<HealthRow["status"], string> = { ok: "Healthy", slow: "Slow", down: "Down" };

const ist = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const ms = (v: number | null) => (v == null ? "-" : v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${v} ms`);
const cell = (status: number | null, t: number | null, slowAt: number) => {
  const bad = status !== 200 && status != null ? "#C62828" : status == null ? "#C62828" : (t ?? 0) > slowAt ? "#D98A12" : "#2c3550";
  return <td style={{ padding: "8px 10px", color: bad, whiteSpace: "nowrap" }}>{status == null ? "no response" : status !== 200 ? `HTTP ${status}` : ms(t)}</td>;
};

export default async function HealthPage() {
  await requireAdmin();
  const s = await loadHealthSummary();
  const latest = s.latest;
  // No stored check for a long time means the database is down or the cron
  // stopped: say so, instead of showing a stale "Healthy".
  const stale = !!latest && Date.now() - Date.parse(latest.at) > RECOVERY_GAP_MS;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 6px" }}>Site health</h1>
        <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>
          A check runs once an hour from Vercel (on-demand with the button): database, auth, home page, catalogue page and the best-selling product page. Trouble and recovery are emailed.
          Slow means a page over {SLOW_PAGE_MS / 1000} s or the database over {SLOW_DB_MS / 1000} s. History is kept for seven days.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Right now</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: stale ? "#C62828" : latest ? COLOR[latest.status] : "#8A93A6" }}>{stale ? "No recent check" : latest ? LABEL[latest.status] : s.error ? "Unavailable" : "No checks yet"}</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 4 }}>
            {stale ? `Nothing stored since ${ist(latest!.at)} IST: the database is down or the hourly check is not running.` : latest ? `${ist(latest.at)} IST${latest.note ? " · " + latest.note : ""}` : s.error ? `Could not read history: ${s.error}.` : "Run migration 0134, then press Check now."}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: s.alertsConfigured ? "#1F9D63" : "#C62828" }}>{s.alertsConfigured ? "Email alerts on" : "Email alerts off (RESEND_API_KEY missing)"}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Uptime, 24 h / 7 d</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{s.uptime24h == null ? "-" : `${s.uptime24h}%`} <span style={{ fontSize: 16, color: "#6B7280" }}>/ {s.uptime7d == null ? "-" : `${s.uptime7d}%`}</span></div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 4 }}>{s.incidents7d} outage{s.incidents7d === 1 ? "" : "s"} in 7 days</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 13, color: "#8A93A6" }}>Slowest 5% today</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6, lineHeight: 1.7 }}>
            database {ms(s.p95.db)}<br />home {ms(s.p95.home)}<br />product page {ms(s.p95.pdp)}
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18, display: "flex", alignItems: "center" }}>
          <HealthCheckNow />
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8A93A6", borderBottom: "1px solid #E8EBF1" }}>
              {["When (IST)", "Status", "Database", "Auth", "Home", "Catalogue", "Product page", "Note"].map((h) => <th key={h} style={{ padding: "10px", fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {s.rows.slice(0, 300).map((r) => (
              <tr key={r.id ?? r.at} style={{ borderBottom: "1px solid #F1F3F8" }}>
                <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{ist(r.at)}</td>
                <td style={{ padding: "8px 10px", fontWeight: 700, color: COLOR[r.status] }}>{LABEL[r.status]}</td>
                {cell(r.db_ok ? 200 : null, r.db_ms, SLOW_DB_MS)}
                <td style={{ padding: "8px 10px", color: r.auth_ok ? "#2c3550" : "#C62828" }}>{r.auth_ok ? ms(r.auth_ms) : "unhealthy"}</td>
                {cell(r.home_status, r.home_ms, SLOW_PAGE_MS)}
                {cell(r.catalogue_status, r.catalogue_ms, SLOW_PAGE_MS)}
                {r.pdp_path ? cell(r.pdp_status, r.pdp_ms, SLOW_PAGE_MS) : <td style={{ padding: "8px 10px", color: "#8A93A6" }}>-</td>}
                <td style={{ padding: "8px 10px", color: "#6B7280" }}>{r.note ?? ""}</td>
              </tr>
            ))}
            {!s.rows.length && <tr><td colSpan={8} style={{ padding: 18, color: "#8A93A6" }}>{s.error ? `Could not read health history: ${s.error}.` : "No checks recorded yet."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
