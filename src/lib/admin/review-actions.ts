"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Review moderation (Admin → Reviews). New reviews land unapproved
 * (0094 flipped the default) and appear on the site only after approval
 * here. The service role sees every column, including the reviewer email
 * and order id the public grants hide.
 */

export type AdminReview = {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  is_approved: boolean;
  is_verified: boolean;
  order_id: string | null;
  reviewer_email: string | null;
  photos: string[] | null;
  created_at: string;
};

export async function listReviewsForAdmin(): Promise<AdminReview[]> {
  if (!(await isAdmin())) return [];
  const db = adminClient();
  if (!db) return [];
  const { data } = await db.from("reviews").select("*").order("created_at", { ascending: false }).limit(500);
  return (data as AdminReview[]) ?? [];
}

type Result = { ok: boolean; error?: string };

/** Drop the cached PDP so an approval (or unpublish) shows immediately. */
function revalidateProduct(productId: string) {
  revalidatePath("/catalogue");
  revalidatePath(`/catalogue/${productId}`);
  revalidatePath("/admin/reviews");
}

export async function setReviewApproval(id: string, approved: boolean): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing - writes disabled." };
  const { data, error } = await db.from("reviews").update({ is_approved: approved }).eq("id", id).select("product_id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (data?.product_id) revalidateProduct(data.product_id);
  return { ok: true };
}

export async function deleteReview(id: string): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing - writes disabled." };
  const { data, error } = await db.from("reviews").delete().eq("id", id).select("product_id, photos").maybeSingle();
  if (error) return { ok: false, error: error.message };
  // Best-effort: clear the orphaned photo files too.
  const paths = (data?.photos ?? [])
    .map((u: string) => u.split("/review-photos/")[1])
    .filter(Boolean);
  if (paths.length) { try { await db.storage.from("review-photos").remove(paths); } catch { /* orphan is harmless */ } }
  if (data?.product_id) revalidateProduct(data.product_id);
  return { ok: true };
}

export async function countPendingReviews(): Promise<number> {
  if (!(await isAdmin())) return 0;
  const db = adminClient();
  if (!db) return 0;
  const { count } = await db.from("reviews").select("id", { count: "exact", head: true }).eq("is_approved", false);
  return count ?? 0;
}
