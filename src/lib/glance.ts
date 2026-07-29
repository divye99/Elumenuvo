import { adminClient } from "@/lib/supabase/admin";

/**
 * 30-day glance views per product, read from the product_metrics_daily
 * warehouse (migration 0061). Service-role only, so this must run inside a
 * server component or route - the collection pages call it during ISR, which
 * means one query every revalidation window, not per visitor.
 *
 * Returns {} when the warehouse is empty or the service key is absent, and
 * every caller treats missing data as "no signal", never as an error.
 */
export async function glanceViews30d(): Promise<Record<string, number>> {
  const db = adminClient();
  if (!db) return {};
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const out: Record<string, number> = {};
  try {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from("product_metrics_daily")
        .select("product_id, glance_views")
        .gte("day", since)
        .range(from, from + 999);
      if (error || !data) break;
      for (const r of data) out[r.product_id] = (out[r.product_id] ?? 0) + (r.glance_views ?? 0);
      if (data.length < 1000) break;
    }
  } catch { /* warehouse not migrated yet - rank without the GV signal */ }
  return out;
}
