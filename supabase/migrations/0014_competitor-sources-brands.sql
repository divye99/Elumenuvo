-- ═══════════════════════════════════════════════════════════════
-- Register the brand-site competitor sources. Run AFTER competitor-pricing-v2.sql.
-- Idempotent. Tier-1 sources are enabled (live adapters); Tier-2 stubs stay
-- disabled so the monthly cron skips them until their endpoint is traced.
--   Adapters live in src/lib/competitors/ and are keyed by these ids.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('crompton',   'Crompton',   'https://www.crompton.co.in', true,  false, 4),  -- Shopify (fans) — LIVE
  ('havells',    'Havells',    'https://havells.com',        true,  false, 5),  -- Magento (fans/switches/wires/lighting) — LIVE
  ('legrand',    'Legrand',    'https://shop.legrand.co.in', false, false, 6),  -- Magento; switch catalogue not in search index — needs category scrape
  ('syska',      'Syska',      'https://syska.co.in',        false, false, 7),  -- Dukaan (stub)
  ('ibo',        'IBO',        'https://www.ibo.com',        false, false, 8),  -- Next.js marketplace (stub)
  ('handypanda', 'HandyPanda', 'https://www.handypanda.in',  false, false, 9)   -- Next.js marketplace (stub)
on conflict (id) do update
  set name = excluded.name, site_url = excluded.site_url, sort_order = excluded.sort_order;

select id, name, enabled, sort_order from public.competitor_sources order by sort_order;
