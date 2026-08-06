import { requireAdmin } from "@/lib/admin/auth";
import { listReviewsForAdmin } from "@/lib/admin/review-actions";
import ReviewsConsole from "@/app/admin/reviews/ReviewsConsole";

export const dynamic = "force-dynamic";

/** Admin → Reviews: moderation queue. New reviews are hidden until approved
 *  here; approving revalidates the product page so the review shows at once. */
export default async function AdminReviews() {
  await requireAdmin();
  const reviews = await listReviewsForAdmin();
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Reviews</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 720 }}>
        Every review is purchase-verified before it reaches this queue. Approve to publish it on the
        product page; unpublish or delete to take it down. Reviewer emails and order IDs are visible
        only here, never on the site.
      </p>
      <ReviewsConsole initial={reviews} />
    </div>
  );
}
