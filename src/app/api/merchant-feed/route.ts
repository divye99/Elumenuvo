import { createClient } from "@supabase/supabase-js";
import { timeoutFetch } from "@/lib/supabase/fetch-timeout";
import { shippingFeeFor, isHeavy, HEAVY_FREIGHT_FEE } from "@/lib/pricing";
import { isMetalCategory } from "@/lib/metals";

/**
 * Google Merchant Center product feed - RSS 2.0 with the g: namespace.
 * Paste https://elumenuvo.com/api/merchant-feed into Merchant Center's
 * "Add products from a file → Enter a link to your file" and every active
 * product stays in sync on Google's daily fetch - no more manual uploads,
 * no stale sources.
 *
 * Field rules that keep items approved:
 *  - g:price is the GST-INCLUSIVE payable amount (exactly what checkout
 *    charges and the PDP states as "incl. GST") - a mismatch with the
 *    landing page is an instant per-item disapproval;
 *  - availability mirrors in_stock, so OOS items list honestly;
 *  - identifier_exists=no when we hold no MPN, instead of a fake one;
 *  - additional_image_link carries the gallery (photo requirements love it).
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SITE = "https://elumenuvo.com";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const abs = (u: string) => (u.startsWith("http") ? u : `${SITE}${u}`);

/** Google product taxonomy per Elume category - exact path strings from
 *  google.com/basepages/producttype/taxonomy.en-US.txt (verified Aug 2026).
 *  Explicit classification beats Google's guess for approval + query matching.
 *  EV Charging has no taxonomy node, so it stays unmapped (auto-classified). */
const GOOGLE_CATEGORY: Record<string, string> = {
  "Wires & Cables": "Hardware > Power & Electrical Supplies > Electrical Wires & Cable",
  "Switchgear": "Hardware > Power & Electrical Supplies > Circuit Breaker Panels",
  "Modular": "Hardware > Power & Electrical Supplies > Electrical Switches",
  "DB & Panels": "Hardware > Power & Electrical Supplies > Circuit Breaker Panels",
  "Fans": "Home & Garden > Household Appliances > Climate Control Appliances > Fans",
  "Lighting": "Home & Garden > Lighting",
  "Water Heaters": "Home & Garden > Household Appliances > Water Heaters",
  "Pumps": "Hardware > Hardware Pumps",
  "Extension Boards": "Electronics > Electronics Accessories > Power > Power Strips & Surge Suppressors",
  "Electrical Accessories": "Hardware > Power & Electrical Supplies",
};

type Row = {
  id: string; name: string; brand: string; category: string; spec: string | null;
  elume_price: number; mrp: number | null; image_url: string | null; images: string[] | null;
  brand_sku: string | null; in_stock: boolean | null; tech_specs: { description?: string } | null;
  ship_weight_kg?: number | string | null;
};

/** Products excluded from the feed for Google image-policy disapprovals
 *  (Merchant Center CSV, 10 Aug 2026). They stay live on the site - their
 *  images are useful there - but would only accumulate disapprovals here.
 *  - ABB: technical line drawings ("image uses a single color")
 *  - Orient Aeon/Aeroslim: every gallery image carries a BEE rosette or
 *    marketing text ("promotional overlay") - verified, no clean shot exists */
const MERCHANT_EXCLUDED = new Set([
  "abb-1sda066980r1", "abb-1sda069058r1", "abb-1sda069060r1", "abb-2196402d",
  "abb-36255128", "abb-5dd4401f", "abb-79613a47",
  "ort-2133661211015", "ort-2133661211315", "ort-2134847810905",
  "ort-2134847817215", "ort-2134848511315", "ort-2134850212015",
]);

export async function GET() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!url || !key) return new Response("feed unavailable", { status: 503 });
  const db = createClient(url, key, { global: { fetch: timeoutFetch } });

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    let { data, error } = await db
      .from("products")
      .select("id,name,brand,category,spec,elume_price,mrp,image_url,images,brand_sku,in_stock,tech_specs,ship_weight_kg")
      .eq("is_active", true)
      .gte("elume_price", 1)
      .order("id")
      .range(from, from + 999);
    // Pre-0110 databases have no ship_weight_kg - retry without it.
    if (error) ({ data, error } = (await db
      .from("products")
      .select("id,name,brand,category,spec,elume_price,mrp,image_url,images,brand_sku,in_stock,tech_specs")
      .eq("is_active", true)
      .gte("elume_price", 1)
      .order("id")
      .range(from, from + 999)) as unknown as { data: typeof data; error: typeof error });
    if (error) return new Response("feed unavailable", { status: 503 });
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }

  const items = rows
    .filter((p) => p.image_url) // Google rejects imageless items; keep them out of the feed
    .filter((p) => !MERCHANT_EXCLUDED.has(p.id))
    // Metals sell as lakh-scale commodity lots via a token + RTGS booking -
    // not a Shopping-feed purchase. Organic search still indexes their PDPs.
    .filter((p) => !isMetalCategory(p.category))
    .map((p) => {
      const gallery = (Array.isArray(p.images) ? p.images : []).filter((u) => u && u !== p.image_url).slice(0, 10);
      const desc = [p.spec, p.tech_specs?.description].filter(Boolean).join(". ").slice(0, 4900) || p.name;
      const idPart = p.brand_sku?.trim()
        ? `      <g:mpn>${esc(p.brand_sku.trim())}</g:mpn>\n      <g:identifier_exists>yes</g:identifier_exists>`
        : `      <g:identifier_exists>no</g:identifier_exists>`;
      return `    <item>
      <g:id>${esc(p.id)}</g:id>
      <g:title>${esc(p.name.slice(0, 150))}</g:title>
      <g:description>${esc(desc)}</g:description>
      <g:link>${SITE}/catalogue/${encodeURIComponent(p.id)}</g:link>
      <g:image_link>${esc(abs(p.image_url!))}</g:image_link>
${gallery.map((u) => `      <g:additional_image_link>${esc(abs(u))}</g:additional_image_link>`).join("\n")}
      <g:availability>${p.in_stock === false ? "out_of_stock" : "in_stock"}</g:availability>
      <g:price>${p.elume_price.toFixed(2)} INR</g:price>
      <g:condition>new</g:condition>
      <g:brand>${esc(p.brand)}</g:brand>
${idPart}
      <g:product_type>${esc(p.category)}</g:product_type>
${GOOGLE_CATEGORY[p.category] ? `      <g:google_product_category>${esc(GOOGLE_CATEGORY[p.category])}</g:google_product_category>` : ""}
      <g:shipping>
        <g:country>IN</g:country>
        <g:price>${(shippingFeeFor(p.elume_price) + (isHeavy(p.ship_weight_kg != null ? Number(p.ship_weight_kg) : null) ? HEAVY_FREIGHT_FEE : 0)).toFixed(2)} INR</g:price>
      </g:shipping>
    </item>`;
    });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Elume - electrical goods, pan-India</title>
    <link>${SITE}</link>
    <description>Every active Elume product for Google Merchant Center.</description>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // CDN-cached for an hour: Google's daily fetch always sees fresh prices
      // without hammering the database.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
