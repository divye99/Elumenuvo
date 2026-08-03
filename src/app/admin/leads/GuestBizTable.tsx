"use client";

import { useState } from "react";
import { nudgeBusinessAccount } from "./actions";

/**
 * Businesses buying without a business account. Every row is someone who has
 * typed a GSTIN at checkout rather than having it applied automatically, so
 * every row is a nudge worth sending, and a retention risk while it is not.
 */
export type GuestBizRow = {
  gstin: string; name: string; email: string; phone: string | null;
  orders: number; paidOrders: number; lastAt: string; state?: string; hasAccount: boolean;
};

export default function GuestBizTable({ rows, when }: { rows: GuestBizRow[]; when: (s: string) => string }) {
  const [sent, setSent] = useState<Record<string, "sending" | "ok" | string>>({});

  const nudge = async (r: GuestBizRow) => {
    setSent((p) => ({ ...p, [r.gstin]: "sending" }));
    const res = await nudgeBusinessAccount({ email: r.email, name: r.name, gstin: r.gstin, orders: r.orders });
    setSent((p) => ({ ...p, [r.gstin]: res.ok ? "ok" : res.error ?? "Failed" }));
  };

  if (rows.length === 0) {
    return (
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
        Every business that has given a GSTIN already has a business account.
      </div>
    );
  }

  const td: React.CSSProperties = { padding: "11px 12px", color: "#56627A", fontSize: 12.5, verticalAlign: "top" };

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F0F2F6", fontSize: 12.5, color: "#56627A" }}>
        These firms typed a GSTIN at checkout but have no business account, so they get no automatic GST invoicing,
        no saved sites and no order history. Sending the nudge invites them to open one.
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8A93A6", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              <th style={{ ...td, fontWeight: 700, padding: "9px 16px" }}>Business</th>
              <th style={{ ...td, fontWeight: 700 }}>GSTIN</th>
              <th style={{ ...td, fontWeight: 700, textAlign: "right" }}>Orders</th>
              <th style={{ ...td, fontWeight: 700, textAlign: "right" }}>Paid</th>
              <th style={{ ...td, fontWeight: 700 }}>Last order</th>
              <th style={{ ...td, fontWeight: 700 }}>Nudge</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = sent[r.gstin];
              return (
                <tr key={r.gstin} style={{ borderTop: i ? "1px solid #F5F6F9" : "1px solid #F0F2F6" }}>
                  <td style={{ ...td, padding: "11px 16px" }}>
                    <div style={{ fontWeight: 700, color: "#19202E", fontSize: 13 }}>{r.name || "(no name)"}</div>
                    <div style={{ color: "#4E5BDC" }}>{r.email}{r.phone ? ` · ${r.phone}` : ""}</div>
                    {r.hasAccount && (
                      <div style={{ fontSize: 11, color: "#C77700", marginTop: 2 }}>has an account, but it is not a business one</div>
                    )}
                  </td>
                  <td style={{ ...td, fontFamily: "var(--space-mono)" }}>
                    {r.gstin}
                    {r.state && <div style={{ fontSize: 11, color: "#8A93A6", fontFamily: "inherit" }}>{r.state}</div>}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>{r.orders}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: r.paidOrders ? 700 : 400, color: r.paidOrders ? "#137a4b" : "#8A93A6" }}>{r.paidOrders}</td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{when(r.lastAt)}</td>
                  <td style={td}>
                    {s === "ok" ? (
                      <span style={{ color: "#137a4b", fontWeight: 700 }}>✓ Sent</span>
                    ) : (
                      <>
                        <button
                          onClick={() => nudge(r)}
                          disabled={s === "sending"}
                          style={{ border: "1px solid #E8EBF1", background: "#fff", color: "#4E5BDC", fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "6px 12px", cursor: s === "sending" ? "default" : "pointer", opacity: s === "sending" ? 0.6 : 1 }}
                        >
                          {s === "sending" ? "Sending…" : "Send nudge"}
                        </button>
                        {s && s !== "sending" && <div style={{ color: "#D14343", fontSize: 11, marginTop: 4 }}>{s}</div>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
