"use client";

import { useActionState, useState } from "react";
import { GROTESK, MONO } from "@/lib/fonts";
import { submitReview, type FormState } from "@/lib/actions";
import type { Review } from "@/lib/reviews";
import Rating, { StarInput } from "@/components/storefront/Rating";

/** Verified customer reviews — compact summary + list, with a collapsible
 *  write-a-review form gated to verified purchasers. */
export default function ReviewsSection({ productId, reviews }: { productId: string; reviews: Review[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview.bind(null, productId), null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 30px 40px" }}>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: GROTESK, fontSize: 16, fontWeight: 600, margin: 0 }}>Verified reviews</h3>
            {reviews.length > 0 ? <Rating rating={avg} count={reviews.length} size={13} /> : <span style={{ fontSize: 12.5, color: "#8A93A6" }}>No reviews yet</span>}
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} style={{ fontSize: 12.5, fontWeight: 600, color: "#4E5BDC", background: "#EEF0FE", border: "none", padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>
              Write a review
            </button>
          )}
        </div>

        {/* Review list (compact) */}
        {reviews.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {reviews.slice(0, 6).map((r) => (
              <div key={r.id} style={{ padding: "11px 0", borderTop: "1px solid #F0F2F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Rating rating={r.rating} size={11} />
                  {r.title && <span style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{r.title}</span>}
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#1F9D63" }}>✓ Verified</span>
                  <span style={{ fontSize: 11.5, color: "#A0A7B5", marginLeft: "auto" }}>
                    {r.author_name} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
                {r.body && <p style={{ fontSize: 13, color: "#3A4358", lineHeight: 1.5, margin: "5px 0 0" }}>{r.body}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Write a review — collapsible, verified purchasers only */}
        {showForm && (
          <form action={action} style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid #F0F2F6" }}>
            <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 10 }}>
              Verified purchasers only — enter your Elume order ID and the email you ordered with.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <StarInput value={rating} hover={hover} size={22} onSet={setRating} onHover={setHover} />
              <input type="hidden" name="rating" value={rating} />
              <span style={{ fontSize: 12, color: "#8A93A6" }}>{rating ? `${rating}/5` : "Tap to rate"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <input name="order_id" placeholder="Order ID (ELM-…)" style={{ ...inp, fontFamily: MONO, fontSize: 12 }} />
              <input name="email" type="email" placeholder="Order email" style={inp} />
              <input name="author" placeholder="Your name" style={inp} />
              <input name="title" placeholder="Title (optional)" style={inp} />
            </div>
            <textarea name="body" placeholder="How did it perform? Build quality, delivery, value…" rows={2} style={{ ...inp, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <button type="submit" disabled={pending} style={{ background: "#4E5BDC", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 9, padding: "9px 18px", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
                {pending ? "Verifying…" : "Verify & post"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#8A93A6", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
              {state && <span style={{ fontSize: 12.5, fontWeight: 600, color: state.ok ? "#1F9D63" : "#D14343" }}>{state.message}</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  border: "1px solid #E0E4ED",
  borderRadius: 9,
  padding: "9px 11px",
  fontSize: 13,
  color: "#19202E",
  outline: "none",
  background: "#FBFCFE",
};
