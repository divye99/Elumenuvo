/** Customer reviews — public read of approved reviews per product.
 *  Verified-purchaser model: inserts are validated in the database against
 *  the orders ledger (see supabase/migrations/0008_verified-reviews.sql). Reviewer emails and
 *  order ids are column-restricted and never selected. */
import { createClient } from "@supabase/supabase-js";

export type Review = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified: boolean;
  created_at: string;
};

// Explicit column list — reviewer_email/order_id are not readable by anon.
const PUBLIC_COLS = "id, product_id, author_name, rating, title, body, is_verified, created_at";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  const c = client();
  if (!c) return [];
  try {
    // No is_approved filter needed — the RLS select policy only exposes
    // approved rows (and the column itself isn't granted to anon).
    const { data, error } = await c
      .from("reviews")
      .select(PUBLIC_COLS)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as unknown as Review[];
  } catch {
    return [];
  }
}
