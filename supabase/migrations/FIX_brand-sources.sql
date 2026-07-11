-- ═══════════════════════════════════════════════════════════════
-- FIX · Restore the brand competitor sources (0014 + 0018 seed rows)
--
-- These rows were never applied on the live DB (the schema-only migration
-- probe didn't catch missing seed data). Without them the competitor_map FK
-- (source → competitor_sources.id) rejects any Havells/Crompton/Syska mapping,
-- and the sync + admin never see those sources. Idempotent — safe to re-run.
-- Equivalent to running 0014 then 0018 in order.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('crompton',   'Crompton',   'https://www.crompton.co.in', true,  false, 4),  -- Shopify (fans) — LIVE
  ('havells',    'Havells',    'https://havells.com',        true,  false, 5),  -- Magento (fans/switches/wires/lighting) — LIVE
  ('legrand',    'Legrand',    'https://shop.legrand.co.in', false, false, 6),  -- Magento; discovery needs category scrape — stays disabled
  ('syska',      'Syska',      'https://syska.co.in',        true,  false, 7),  -- Dukaan — LIVE (enabled here, was 0018)
  ('ibo',        'IBO',        'https://www.ibo.com',        false, false, 8),  -- stub — stays disabled
  ('handypanda', 'HandyPanda', 'https://www.handypanda.in',  true,  false, 9)   -- Next.js marketplace — LIVE (enabled here, was 0018)
on conflict (id) do update
  set name = excluded.name, site_url = excluded.site_url, enabled = excluded.enabled, sort_order = excluded.sort_order;

select id, name, enabled, sort_order from public.competitor_sources order by sort_order;
