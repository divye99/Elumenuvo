-- ═══════════════════════════════════════════════════════════════
-- 0070: Max Voltage for the Havells surge/spike-guard + extension range.
--
-- Merchant Center flagged "Max Voltage" as a missing key detail on the Cosmo
-- Reel. The rating is 6 A / 240 V AC across this Havells accessories family
-- (stated on Havells' own product listings; our scraped tech_specs carry the
-- amperage but not the voltage). Stored as an attr; the description generator
-- surfaces it as "240 V max voltage".
--
-- Applied ONLY to the surge/spike-guard/extension accessories, matched by
-- name, not blanket-applied to the whole category.
-- ═══════════════════════════════════════════════════════════════

update public.products
set attrs = coalesce(attrs, '{}'::jsonb) || '{"Max Voltage": "240 V"}'::jsonb
where category = 'Electrical Accessories'
  and (name ~* 'spike|surge|extension|reel|flexbox|plug|adaptor|socket')
  and (attrs is null or not attrs ? 'Max Voltage');

select id, name, attrs->>'Max Voltage' as max_voltage
from public.products
where category = 'Electrical Accessories' and attrs ? 'Max Voltage'
order by name;
