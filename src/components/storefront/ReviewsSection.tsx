"use client";

import { useActionState, useEffect, useState } from "react";
import { GROTESK, MONO } from "@/lib/fonts";
import { submitReview, type FormState } from "@/lib/actions";
import type { Review } from "@/lib/reviews";
import Rating, { StarInput } from "@/components/storefront/Rating";
import PdpCollapse from "@/components/storefront/PdpCollapse";

/** Verified customer reviews - compact summary + list, with a collapsible
 *  write-a-review form gated to verified purchasers. */
export default function ReviewsSection({ productId, reviews }: { productId: string; reviews: Review[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview.bind(null, productId), null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  // Signed-in purchasers skip the order-ID/email fields: the server already
  // knows their orders. This probe is a UX hint only - submission re-verifies.
  const [me, setMe] = useState<{ eligible: boolean; orderId?: string; name?: string } | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/me/review-context?product=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((d) => { if (live) setMe(d); })
      .catch(() => {});
    return () => { live = false; };
  }, [productId]);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;

  return (
    // id anchors the review-request email's deep links (…/catalogue/<id>#reviews)
    <div id="reviews" className="pdp-wrap" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 30px 40px", scrollMarginTop: 90 }}>
      <PdpCollapse title="Verified reviews" sec="reviews" count={reviews.length ? `${reviews.length}` : "none yet"} openOnHash="reviews">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            {reviews.length > 0 ? <Rating rating={avg} count={reviews.length} size={13} /> : <span style={{ fontSize: 12.5, color: "#8A93A6" }}>No reviews yet</span>}
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} style={{ fontSize: 12.5, fontWeight: 600, color: "#1D2F8A", background: "#E9EDF9", border: "none", padding: "7px 14px", borderRadius: 8, cursor: "pointer" }}>
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
                {(r.photos?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    {r.photos!.map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" title="Open photo">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Customer photo" loading="lazy" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 9, border: "1px solid #E8EBF1", display: "block" }} />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Write a review - collapsible, verified purchasers only */}
        {showForm && (
          <form action={action} style={{ marginTop: 12, paddingTop: 14, borderTop: "1px solid #F0F2F6" }}>
            {me?.eligible ? (
              <div style={{ fontSize: 12, fontWeight: 600, color: "#137a4b", background: "#E6F5EE", border: "1px solid #B6E2C8", borderRadius: 8, padding: "7px 11px", marginBottom: 10, display: "inline-block" }}>
                ✓ Verified purchase · order {me.orderId} - no order details needed
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 10 }}>
                Verified purchasers only - enter your Elume order ID and the email you ordered with.
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
              <StarInput value={rating} hover={hover} size={22} onSet={setRating} onHover={setHover} />
              <input type="hidden" name="rating" value={rating} />
              <span style={{ fontSize: 12, color: "#8A93A6" }}>{rating ? `${rating}/5` : "Tap to rate"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              {!me?.eligible && (
                <>
                  <input name="order_id" placeholder="Order ID (ELM-…)" style={{ ...inp, fontFamily: MONO, fontSize: 12 }} />
                  <input name="email" type="email" placeholder="Order email" style={inp} />
                </>
              )}
              <input name="author" placeholder="Your name" defaultValue={me?.eligible ? me.name ?? "" : ""} style={inp} />
              <input name="title" placeholder="Title (optional)" style={inp} />
            </div>
            <textarea name="body" placeholder="How did it perform? Build quality, delivery, value…" rows={2} style={{ ...inp, width: "100%", resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ marginTop: 10, background: "#FBFCFE", border: "1px dashed #D5DAE4", borderRadius: 10, padding: "10px 12px" }}>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: "#3A4358", cursor: "pointer", display: "block" }}>
                📷 Add photos of the product or the delivery{photoCount > 0 ? ` · ${photoCount} selected` : " (optional, up to 4)"}
                <input
                  type="file"
                  name="photos"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotoCount(e.target.files?.length ?? 0)}
                  style={{ display: "block", marginTop: 6, fontSize: 12 }}
                />
              </label>
              <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 5 }}>
                Photos help other buyers most - the coil as it arrived, the fan installed, the packaging.
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
              <button type="submit" disabled={pending} style={{ background: "#1D2F8A", color: "#fff", fontSize: 13, fontWeight: 700, border: "none", borderRadius: 9, padding: "9px 18px", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}>
                {pending ? "Verifying…" : "Verify & post"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#8A93A6", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
              {state && <span style={{ fontSize: 12.5, fontWeight: 600, color: state.ok ? "#1F9D63" : "#D14343" }}>{state.message}</span>}
            </div>
          </form>
        )}
      </PdpCollapse>
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
