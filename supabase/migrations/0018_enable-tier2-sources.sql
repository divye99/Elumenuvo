-- ═══════════════════════════════════════════════════════════════
-- Enable the Tier-2 sources that now have live adapters: Syska (Dukaan
-- product-page scrape) and HandyPanda (Next.js marketplace scrape). Run AFTER
-- 0014_competitor-sources-brands.sql. Idempotent. IBO stays disabled (its
-- Cloudflare + client-side pincode API still needs a live browser trace).
-- ═══════════════════════════════════════════════════════════════

update public.competitor_sources set enabled = true where id in ('syska', 'handypanda');

select id, name, enabled, sort_order from public.competitor_sources order by sort_order;
