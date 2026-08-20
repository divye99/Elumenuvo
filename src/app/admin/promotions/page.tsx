import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import PromotionsConsole, { type PromoRow } from "./PromotionsConsole";

/** Admin → Promotions: Google Merchant Center promotions, served to Google
 *  as the self-updating feed at /api/merchant-promotions (registered once
 *  in Merchant Center as a file-from-link source, like the product feed). */
export const dynamic = "force-dynamic";

export default async function PromotionsPage() {
  await requireAdmin();
  const db = adminClient();
  const { data } = db
    ? await db.from("merchant_promotions").select("*").order("created_at", { ascending: false }).limit(200).then((r) => r, () => ({ data: null as any }))
    : { data: null };
  return <PromotionsConsole rows={(data ?? []) as PromoRow[]} tableMissing={db != null && data == null} />;
}

export const metadata = { title: "Promotions · Elume Admin" };
