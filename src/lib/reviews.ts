/** Customer reviews — public read of approved reviews per product. */
import { createClient } from "@supabase/supabase-js";

export type Review = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
};

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
    const { data, error } = await c
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .eq("is_approved", true)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !data) return [];
    return data as Review[];
  } catch {
    return [];
  }
}
