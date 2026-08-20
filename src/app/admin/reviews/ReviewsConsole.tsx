"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { istDateTime } from "@/lib/admin/ist";
import { setReviewApproval, deleteReview, type AdminReview } from "@/lib/admin/review-actions";

/** Moderation queue: pending first, then published. */
export default function ReviewsConsole({ initial }: { initial: AdminReview[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  const pending = initial.filter((r) => !r.is_approved);
  const published = initial.filter((r) => r.is_approved);

  const act = (id: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusyId(id);
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? null : res.error ?? "Failed.");
      setBusyId(null);
      router.refresh();
    });
  };

  const Card = ({ r }: { r: AdminReview }) => (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#E0A100", letterSpacing: 1 }}>{"⚡".repeat(r.rating)}<span style={{ opacity: 0.25 }}>{"⚡".repeat(5 - r.rating)}</span></span>
        {r.title && <span style={{ fontSize: 13.5, fontWeight: 700 }}>{r.title}</span>}
        <a href={`/catalogue/${r.product_id}#reviews`} target="_blank" rel="noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#1D2F8A" }}>
          {r.product_id} ↗
        </a>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5", whiteSpace: "nowrap" }}>{istDateTime(r.created_at)}</span>
      </div>
      {r.body && <p style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.55, margin: "7px 0 0" }}>{r.body}</p>}
      {(r.photos?.length ?? 0) > 0 && (
        <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
          {r.photos!.map((u) => (
            <a key={u} href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="Review photo" loading="lazy" style={{ width: 68, height: 68, objectFit: "cover", borderRadius: 9, border: "1px solid #E8EBF1", display: "block" }} />
            </a>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, color: "#8A93A6", fontFamily: "var(--space-mono)" }}>
          {r.author_name} · {r.reviewer_email ?? "-"} · {r.order_id ?? "no order"}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {r.is_approved ? (
            <button onClick={() => act(r.id, () => setReviewApproval(r.id, false))} disabled={busyId === r.id} style={{ ...btn, color: "#C77700", borderColor: "#F0DFC0" }}>
              Unpublish
            </button>
          ) : (
            <button onClick={() => act(r.id, () => setReviewApproval(r.id, true))} disabled={busyId === r.id} style={{ ...btn, background: "#137a4b", color: "#fff", border: "none" }}>
              ✓ Approve & publish
            </button>
          )}
          <button
            onClick={() => { if (confirm("Delete this review permanently? Its photos are removed too.")) act(r.id, () => deleteReview(r.id)); }}
            disabled={busyId === r.id}
            style={{ ...btn, color: "#C0392B", borderColor: "#F0C8C0" }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {msg && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{msg}</div>}

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>
          Awaiting approval {pending.length > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: "#F25929", borderRadius: 20, padding: "2px 9px", marginLeft: 6 }}>{pending.length}</span>}
        </h2>
        {pending.length === 0 ? (
          <div style={{ border: "1px dashed #D5DAE4", borderRadius: 12, padding: "18px", fontSize: 13, color: "#8A93A6" }}>Queue is clear - nothing waiting.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{pending.map((r) => <Card key={r.id} r={r} />)}</div>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>Published ({published.length})</h2>
        {published.length === 0 ? (
          <div style={{ border: "1px dashed #D5DAE4", borderRadius: 12, padding: "18px", fontSize: 13, color: "#8A93A6" }}>No published reviews yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{published.map((r) => <Card key={r.id} r={r} />)}</div>
        )}
      </section>
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E0E4ED",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 13px",
  borderRadius: 8,
  cursor: "pointer",
};
