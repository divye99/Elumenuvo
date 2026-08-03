import { istDateTime } from "@/lib/admin/ist";
import { OUTREACH_ROSTER, OUTREACH_SENT_ON, outreachName, type OutreachCompany } from "@/lib/admin/outreach-roster";

/**
 * The cold-outreach scoreboard: one row per emailed firm, engaged ones first,
 * silent ones kept visible because that list is the phone-follow-up list.
 * Purely presentational - all attribution happens in the analytics page.
 */

export type OutreachStat = {
  sessions: number; pageviews: number; carts: number; ms: number;
  lastSeen: string | null; email: string | null;
  /** How the firm was identified: a tagged link, or their email domain. */
  via: "link" | "domain";
};
export type OutreachStage = { label: string; rank: number; color: string };
export type OutreachRow = OutreachCompany & {
  st?: OutreachStat;
  survey?: { company: string; phone: string; created_at: string };
  stage: OutreachStage;
};

const dur = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
const th: React.CSSProperties = { padding: "9px 10px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "9px 10px", color: "#56627A" };
const num: React.CSSProperties = { ...td, textAlign: "right" };

export default function OutreachTable({
  rows, stray, surveyCount,
}: {
  rows: OutreachRow[];
  stray: [string, OutreachStat][];
  surveyCount: number;
}) {
  const bounced = OUTREACH_ROSTER.filter((c) => c.bounced).length;
  const traced = rows.filter((r) => r.st).length;

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontSize: 14.5 }}>Cold outreach · {OUTREACH_ROSTER.length - bounced} firms reached</span>
          <span style={{ color: "#8A93A6", fontWeight: 400, fontSize: 12.5 }}>
            · sent {OUTREACH_SENT_ON}
            · <b style={{ color: traced ? "#137a4b" : "#8A93A6" }}>{traced}</b> traced back
            · {rows.filter((r) => r.survey).length} took the survey
            · {rows.filter((r) => r.st?.carts).length} added to cart
            · <b style={{ color: "#B4341C" }}>{bounced}</b> bounced
          </span>
        </div>
        <p style={{ fontSize: 12, color: "#8A93A6", margin: "6px 0 0", maxWidth: 860 }}>
          This batch went out before per-company link tagging, so a firm is named here once someone from its email
          domain identifies on the site (signs up, checks out) or its name appears on a survey response. Anonymous
          browsing from these emails still counts, but only at campaign level: use the <b>Cold outreach only</b> source
          filter on the Visitors tab. Future campaigns whose links carry{" "}
          <code style={{ fontFamily: "var(--space-mono)" }}>utm_content</code> attribute from the first click.
        </p>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 780 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8A93A6", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <th style={{ ...th, padding: "9px 18px" }}>Company</th>
              <th style={th}>Segment</th>
              <th style={th}>Stage</th>
              <th style={{ ...th, textAlign: "right" }}>Visits</th>
              <th style={{ ...th, textAlign: "right" }}>Pages</th>
              <th style={{ ...th, textAlign: "right" }}>Time</th>
              <th style={th}>Survey</th>
              <th style={{ ...th, padding: "9px 18px" }}>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.slug} style={{ borderTop: i ? "1px solid #F5F6F9" : "1px solid #F0F2F6", background: r.st ? "#fff" : "#FCFCFD" }}>
                <td style={{ padding: "9px 18px", fontWeight: 700, color: r.st ? "#19202E" : r.bounced ? "#B4341C" : "#8A93A6" }}>
                  {r.company}
                  {r.st?.email && <div style={{ fontWeight: 500, fontSize: 11.5, color: "#137a4b" }}>{r.st.email}</div>}
                  {r.bounced && <div style={{ fontWeight: 500, fontSize: 11.5, color: "#B4341C" }}>{r.domain} rejected the mail</div>}
                  {r.st?.via === "domain" && <div style={{ fontWeight: 500, fontSize: 11, color: "#8A93A6" }}>matched by email domain</div>}
                </td>
                <td style={td}>{r.segment}</td>
                <td style={{ ...td, fontWeight: 700, color: r.stage.color }}>{r.stage.label}</td>
                <td style={num}>{r.st?.sessions || "–"}</td>
                <td style={num}>{r.st?.pageviews || "–"}</td>
                <td style={num}>{r.st?.ms ? dur(r.st.ms) : "–"}</td>
                <td style={{ ...td, color: r.survey ? "#137a4b" : "#C9CFDA", fontWeight: r.survey ? 700 : 400 }}>
                  {r.survey ? `✓ ${r.survey.phone}` : "–"}
                </td>
                <td style={{ ...td, padding: "9px 18px", color: "#A0A7B5", whiteSpace: "nowrap" }}>
                  {r.st?.lastSeen ? istDateTime(r.st.lastSeen) : "–"}
                </td>
              </tr>
            ))}
            {stray.map(([slug, st]) => (
              <tr key={`stray-${slug}`} style={{ borderTop: "1px solid #F5F6F9", background: "#FFFBF2" }}>
                <td style={{ padding: "9px 18px", fontWeight: 700 }}>
                  {outreachName(slug)}
                  <div style={{ fontWeight: 500, fontSize: 11.5, color: "#C77700" }}>not on the roster (forwarded?)</div>
                </td>
                <td style={td}>–</td>
                <td style={{ ...td, fontWeight: 700, color: "#C77700" }}>Opened site</td>
                <td style={num}>{st.sessions}</td>
                <td style={num}>{st.pageviews}</td>
                <td style={num}>{st.ms ? dur(st.ms) : "–"}</td>
                <td style={{ ...td, color: "#C9CFDA" }}>–</td>
                <td style={{ ...td, padding: "9px 18px", color: "#A0A7B5", whiteSpace: "nowrap" }}>
                  {st.lastSeen ? istDateTime(st.lastSeen) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {surveyCount > 0 && rows.every((r) => !r.survey) && (
        <div style={{ padding: "11px 18px", borderTop: "1px solid #F0F2F6", fontSize: 12, color: "#8A93A6" }}>
          {surveyCount} survey response{surveyCount === 1 ? "" : "s"} received, none matching a roster company name. See Leads → Trade survey.
        </div>
      )}
    </div>
  );
}
