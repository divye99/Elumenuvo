"use client";

import { useActionState, useState } from "react";
import { GROTESK, MONO } from "@/lib/fonts";
import { submitReview, type FormState } from "@/lib/actions";
import type { Review } from "@/lib/reviews";
import Rating, { Bolt } from "@/components/storefront/Rating";

/** Verified customer reviews — volt-rating summary, review list, and a
 *  write-a-review form gated to verified purchasers (order ID + email are
 *  checked against the orders ledger inside the database). */
export default function ReviewsSection({ productId, reviews }: { productId: string; reviews: Review[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitReview.bind(null, productId),
    null
  );
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 30px 48px" }}>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "26px 28px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>
            Verified reviews
          </h3>
          {reviews.length > 0 ? (
            <Rating rating={avg} count={reviews.length} size={15} />
          ) : (
            <span style={{ fontSize: 13, color: "#8A93A6" }}>No reviews yet.</span>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "#8A93A6" }}>
          Every review is from a verified Elume purchaser of this product — no exceptions.
        </div>

        {/* Review list */}
        {reviews.length > 0 && (
          <div style={{ margin: "16px 0 6px" }}>
            {reviews.map((r) => (
              <div key={r.id} style={{ padding: "16px 0", borderTop: "1px solid #F0F2F6" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <Rating rating={r.rating} size={12} />
                  {r.title && <span style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{r.title}</span>}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "3px 9px", borderRadius: 9 }}>
                    <Bolt size={10} color="#1F9D63" /> Verified purchase
                  </span>
                </div>
                {r.body && (
                  <p style={{ fontSize: 13.5, color: "#3A4358", lineHeight: 1.55, margin: "8px 0 6px" }}>{r.body}</p>
                )}
                <div style={{ fontSize: 12, color: "#8A93A6" }}>
                  {r.author_name} · {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Write a review — verified purchasers only */}
        <form action={action} style={{ marginTop: 18, paddingTop: 20, borderTop: "1px solid #F0F2F6" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#19202E" }}>Write a review</span>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: "#4E5BDC", background: "#EEF0FE", padding: "3px 9px", borderRadius: 9 }}>
              Verified purchasers only
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 14 }}>
            Enter the order ID from your Elume invoice and the email you ordered with — we match them
            before your review goes live.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input name="order_id" placeholder="Order ID (e.g. ELM-2607-0142)" style={{ ...inp, fontFamily: MONO, fontSize: 12.5 }} />
            <input name="email" type="email" placeholder="Email used on the order" style={inp} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 14 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRating(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(0)}
                aria-label={`${i} bolt${i > 1 ? "s" : ""}`}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}
              >
                <Bolt size={26} color={i <= (hover || rating) ? "#F4B400" : "#D9DEE8"} />
              </button>
            ))}
            <input type="hidden" name="rating" value={rating} />
            <span style={{ fontSize: 12.5, color: "#8A93A6", marginLeft: 8 }}>
              {rating ? `${rating}/5 volts` : "Tap to rate"}
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input name="author" placeholder="Your name (shown publicly)" style={inp} />
            <input name="title" placeholder="Review title (optional)" style={inp} />
          </div>
          <textarea name="body" placeholder="How did the product perform? Build quality, delivery, value…" rows={3} style={{ ...inp, width: "100%", resize: "vertical", fontFamily: "inherit" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            <button
              type="submit"
              disabled={pending}
              style={{ background: "#4E5BDC", color: "#fff", fontSize: 13.5, fontWeight: 700, border: "none", borderRadius: 10, padding: "11px 22px", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}
            >
              {pending ? "Verifying…" : "Verify & post review"}
            </button>
            {state && (
              <span style={{ fontSize: 13, fontWeight: 600, color: state.ok ? "#1F9D63" : "#D14343" }}>
                {state.message}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#A0A7B5", marginTop: 10 }}>
            Your email is used only for purchase verification — it is never published or shared.
          </div>
        </form>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  border: "1px solid #E0E4ED",
  borderRadius: 10,
  padding: "11px 13px",
  fontSize: 13.5,
  color: "#19202E",
  outline: "none",
  background: "#FBFCFE",
};
