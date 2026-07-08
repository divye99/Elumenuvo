-- ═══════════════════════════════════════════════════════════════
-- Register + enable the Atomberg own-store and BestOfElectricals distributor
-- sources. Run AFTER 0014_competitor-sources-brands.sql. Idempotent.
--   • atomberg          — atomberg.com, Magento GraphQL (BLDC fans; true MRP).
--   • bestofelectricals — bestofelectricals.com, nopCommerce distributor with
--     explicit MRP + selling price; carries Norisys, Havells, Legrand, Anchor,
--     Polycab, Finolex, Philips, Wipro, Usha, ABB, Schneider, KEI, RR Kabel, Hager.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('atomberg',          'Atomberg',          'https://atomberg.com',              true, false, 10),
  ('bestofelectricals', 'BestOfElectricals', 'https://www.bestofelectricals.com', true, false, 11)
on conflict (id) do update
  set name = excluded.name, site_url = excluded.site_url, enabled = excluded.enabled, sort_order = excluded.sort_order;

select id, name, enabled, sort_order from public.competitor_sources order by sort_order;
