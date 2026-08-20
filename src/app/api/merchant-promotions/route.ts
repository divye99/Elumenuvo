import { adminClient } from "@/lib/supabase/admin";

/**
 * Google Merchant Center PROMOTIONS feed - RSS 2.0 with the g: namespace,
 * sibling of /api/merchant-feed. Register once in Merchant Center
 * (Marketing → Promotions → add from a file → enter a link) and every
 * active promotion managed in /admin/promotions stays in sync on Google's
 * scheduled fetch.
 *
 * Spec notes that keep promotions approved:
 *  - promotion_effective_dates is an ISO-8601 range in IST, max 6 months;
 *  - long_title is capped at 60 chars (Google hard limit);
 *  - GENERIC_CODE promotions carry one shared code - our one-time
 *    ELUME10-XXXX discount codes must never appear here;
 *  - expired or deactivated promotions simply drop out of the feed.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const istStamp = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return `${d.toISOString().slice(0, 19)}+05:30`.replace(/\.\d{3}/, "");
};

export async function GET() {
  const db = adminClient();
  const now = new Date().toISOString();
  const { data } = db
    ? await db.from("merchant_promotions").select("*").eq("active", true).gte("ends_at", now).order("starts_at", { ascending: true }).limit(200).then((r) => r, () => ({ data: [] as any[] }))
    : { data: [] as any[] };

  const items = (data ?? []).map((p: any) => {
    const lines = [
      `<g:promotion_id>${esc(p.promotion_id)}</g:promotion_id>`,
      `<g:product_applicability>${p.applicability}</g:product_applicability>`,
      `<g:offer_type>${p.offer_type}</g:offer_type>`,
      ...(p.offer_type === "GENERIC_CODE" && p.redemption_code ? [`<g:generic_redemption_code>${esc(p.redemption_code)}</g:generic_redemption_code>`] : []),
      `<g:long_title>${esc(String(p.long_title).slice(0, 60))}</g:long_title>`,
      `<g:promotion_effective_dates>${istStamp(p.starts_at)}/${istStamp(p.ends_at)}</g:promotion_effective_dates>`,
      `<g:redemption_channel>ONLINE</g:redemption_channel>`,
      ...(p.min_purchase != null && Number(p.min_purchase) > 0 ? [`<g:minimum_purchase_amount>${Number(p.min_purchase).toFixed(2)} INR</g:minimum_purchase_amount>`] : []),
      ...(p.applicability === "SPECIFIC_PRODUCTS" && Array.isArray(p.item_ids)
        ? p.item_ids.slice(0, 500).map((id: string) => `<g:item_id>${esc(id)}</g:item_id>`)
        : []),
    ];
    return `<item>\n${lines.join("\n")}\n</item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Elume promotions</title>
<link>https://elumenuvo.com</link>
<description>Active Elume promotions for Google Merchant Center</description>
${items.join("\n")}
</channel>
</rss>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
