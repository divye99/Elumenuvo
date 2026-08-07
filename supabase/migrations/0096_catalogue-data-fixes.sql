-- ═══════════════════════════════════════════════════════════════
-- 0096: Catalogue data fixes surfaced by the compare-engine audit.
-- Idempotent: safe to re-run.
--
-- 1. EURO2 RCCBs: 23 listings shared a series-range spec ("Rating 16 A to
--    63 A") with identical names, hiding that each SKU is a specific
--    amperage variant (encoded in the Havells SKU: DHRACMDF<mA><A>).
--    Names, specs and attrs now carry the real per-variant rating, which
--    also lets the compare engine map them (range specs are quarantined).
--    Also fixes the "Senstivity"/"Ma" typos from the source data.
-- 2. KEI Conflame Green+ wires: Grade attr said "HRFR" (heat-resistant,
--    non-low-smoke) while Quality correctly says "HR FR-LSH". Grade now
--    agrees with Quality.
-- 3. HTML entities and smart quotes in product names (&#x2B;, &amp;, curly
--    quotes) - decoded so names render clean everywhere.
-- 4. Four Havells listings missing the brand prefix in their names.
-- 5. NU Plus lamp whose name said 12 W while spec/attrs said 18 W: its
--    1,200 lm rating is 12 W-class, so 18 W was the error.
--
-- After running this, hit "Rebuild mappings now" in /admin/compare so the
-- fixed rows get their compare fingerprints.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. EURO2 RCCB per-variant ratings ──
update public.products set name = 'Havells DP RCCB EURO2 D7 · 16 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 16 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '16 A') where id = 'hav-dhracmdf030016';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 25 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 25 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '25 A') where id = 'hav-dhracmdf030025';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 32 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 32 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '32 A') where id = 'hav-dhracmdf030032';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 40 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmdf030040';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 63 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmdf030063';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 25 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 25 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '25 A') where id = 'hav-dhracmdf100025';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 32 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 32 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '32 A') where id = 'hav-dhracmdf100032';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 40 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmdf100040';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 63 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmdf100063';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 32 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 32 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '32 A') where id = 'hav-dhracmdf300032';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 40 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmdf300040';
update public.products set name = 'Havells DP RCCB EURO2 D7 · 63 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 16 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmdf300063';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 25 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 25 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '25 A') where id = 'hav-dhracmff030025';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 32 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 32 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '32 A') where id = 'hav-dhracmff030032';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 40 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmff030040';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 63 A · 30 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmff030063';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 25 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 25 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '25 A') where id = 'hav-dhracmff100025';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 40 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmff100040';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 63 A · 100 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmff100063';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 25 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 25 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '25 A') where id = 'hav-dhracmff300025';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 32 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 32 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '32 A') where id = 'hav-dhracmff300032';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 40 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 40 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '40 A') where id = 'hav-dhracmff300040';
update public.products set name = 'Havells FP RCCB EURO2 D7 · 63 A · 300 mA', spec = replace(replace(replace(spec, 'Rating 25 A to 63 A', 'Rating 63 A'), 'Senstivity', 'Sensitivity'), ' Ma ', ' mA '), attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Rating', '63 A') where id = 'hav-dhracmff300063';

-- ── 2. KEI Conflame Green+ Grade attr ──
update public.products
  set attrs = attrs || jsonb_build_object('Grade', 'HR FR-LSH')
  where name ilike '%Conflame Green+%' and attrs->>'Grade' = 'HRFR';

-- ── 3. HTML entities / smart quotes in names ──
update public.products set name =
  replace(replace(replace(replace(replace(replace(replace(name,
    '&#x2B;', '+'), '&#x2b;', '+'), '&amp;', '&'), '&quot;', '"'),
    '“', '"'), '”', '"'), '’', '''')
  where name like '%&#x2B;%' or name like '%&#x2b;%' or name like '%&amp;%'
     or name like '%&quot;%' or name like '%“%' or name like '%”%' or name like '%’%';

-- ── 4. Havells names missing the brand prefix ──
update public.products set name = 'Havells ' || name
  where brand = 'Havells' and name not ilike 'havells%'
    and name in ('Ventilair 230mm Exhaust Fan', '6-way TPN DB · Double Door', '8-way SPN DB · Double Door', 'DP MCB 32A ''C'' curve');

-- ── 5. NU Plus lamp wattage (1,200 lm = 12 W class; 18 W was the typo) ──
update public.products
  set name = 'Havells NU Plus 12 W B22 CDL Lamp',
      spec = replace(spec, 'Wattage (W) 18 W', 'Wattage (W) 12 W'),
      attrs = coalesce(attrs, '{}'::jsonb) || jsonb_build_object('Wattage', '12 W')
  where id = 'hav-lhldeuecnl9r018';
