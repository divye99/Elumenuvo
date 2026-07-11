-- ═══════════════════════════════════════════════════════════════
-- 0028 · Orient Electric as a competitor price source
--
-- orientelectric.com is a Shopify DTC store — same engine as Crompton. Verified
-- live: search suggest + per-variant sku/EAN barcode + compare_at_price (MRP),
-- e.g. Aeroquiet Neu ₹8221 selling / ₹9350 MRP. Enabled so the monthly sync and
-- the admin "Add a seller" search both pick it up (adapter: orientAdapter).
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('orient', 'Orient', 'https://orientelectric.com', true, false, 12)
on conflict (id) do update
  set name = excluded.name, site_url = excluded.site_url, enabled = excluded.enabled, sort_order = excluded.sort_order;

select id, name, enabled, sort_order from public.competitor_sources order by sort_order;
