-- ═══════════════════════════════════════════════════════════════
-- 0033 · Wire lines corrected + detailed from OFFICIAL brand catalogues
--
-- Sources (user-supplied, extracted 2026-07-13):
--   Polycab House Wires Catalogue (March 25): the current retail range is
--     Suprema (E-beam HR FR LF, 105C) / Maxima+ "Green Wire" (HR FR-LSH LF,
--     85C) / Optima+ (LF FR) / Primma (LF FR) / Etira (FR). There is NO line
--     called plain "FRLS": the FR-LSH house wire IS Maxima+ Green Wire, with
--     per-size product codes (LDIS09CYUAYL001C…).
--   Havells Consumer Cable Catalogue: retail house wire is Life Line Plus S3
--     (HRFR PVC, class-V IS 8130 conductor), Life Guard (FR-LSH),
--     Life Shield (HFFR, IS 17048). Ours is the Life Line Plus S3 line.
--   RR Kabel Integrated Brochure: SUPEREX is FR (our spec wrongly said
--     HR PVC; UNILAY HR FR is their heat-resistant line). Superex part
--     numbers per size: 010101<size>xx20 (xx = colour code) - the size stem
--     is stored as brand_sku for cross-site matching.
--   KEI catalogue: industrial LT/HT only; no retail Conflame codes. Spec
--     enriched with construction facts, name kept (Conflame FR is correct).
--   Finolex: retail tiers Gold FR / Silver FR / FRLSH; our generic FR naming
--     stays, spec already canonical via 0032.
--
-- MRPs untouched (these catalogues carry no prices). Idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Polycab: "FRLS Wire" line is really MAXIMA+ Green Wire HR FR-LSH LF ──
update public.products set
  name = replace(name, 'FRLS Wire', 'Maxima+ Green Wire HR FR-LSH'),
  attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"HR FR-LSH"')
where brand = 'Polycab' and category = 'Wires & Cables' and name like '%FRLS Wire%';

-- Per-size spec (official strand construction) + Polycab product code as brand_sku.
update public.products p set
  spec = c.size || ' sq mm · single core · ' || c.strands || ' strand bright annealed copper · '
         || coalesce(nullif(trim(p.attrs->>'Length'), ''), '90 m') || ' coil · HR FR-LSH LF PVC · 85°C · lead free · 1100 V · IS 694',
  brand_sku = c.code
from (values
  ('0.75', '24/0.21', 'LDIS09CYUAYL001C.75S'),
  ('1',    '14/0.31', 'LDIS09CYUAYL001C001S'),
  ('1.5',  '22/0.31', 'LDIS09CYUAYL001C1.5S'),
  ('2.5',  '36/0.31', 'LDIS09CYUAYL001C2.5S'),
  ('4',    '56/0.31', 'LDIS09CYUAYL001C004S'),
  ('6',    '84/0.31', 'LDIS09CYUAYL001C006S')
) as c(size, strands, code)
where p.brand = 'Polycab' and p.category = 'Wires & Cables'
  and p.name like '%Maxima+%'
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.size::numeric;

-- Polycab plain-FR odd one out (poly-fr-60 etc.): that is the Etira FR line.
update public.products set
  name = replace(name, 'FR Wire', 'Etira FR Wire')
where brand = 'Polycab' and category = 'Wires & Cables'
  and name like 'FR Wire%' and name not like '%Maxima+%';

-- ── 2. Havells: "Life Line FR" is really LIFE LINE PLUS S3 (HRFR PVC) ──
update public.products set
  name = replace(name, 'Life Line FR Wire', 'Life Line Plus S3 HRFR Wire'),
  attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"HRFR"'),
  spec = split_part(attrs->>'Size', ' ', 1) || ' sq mm · single core · class-V flexible copper (IS 8130) · '
         || coalesce(nullif(trim(attrs->>'Length'), ''), '90 m') || ' coil · HRFR PVC · 1100 V · IS 694'
where brand = 'Havells' and category = 'Wires & Cables'
  and name like '%Life Line%' and attrs->>'Size' is not null;

-- ── 3. RR Kabel Superex: grade is FR (not HR PVC) + part-number stems ──
update public.products p set
  attrs = jsonb_set(coalesce(p.attrs, '{}'::jsonb), '{Quality}', '"FR"'),
  spec = c.size || ' sq mm · single core · ' || c.strands || ' strand copper (IS 8130) · '
         || coalesce(nullif(trim(p.attrs->>'Length'), ''), '90 m') || ' coil · FR PVC · LOI >29% · 1100 V · IS 694',
  brand_sku = c.stem
from (values
  ('0.75', '24/0.2', '01010102'),
  ('1',    '14/0.3', '01010103'),
  ('1.5',  '22/0.3', '01010104'),
  ('2.5',  '36/0.3', '01010105'),
  ('4',    '56/0.3', '01010106'),
  ('6',    '84/0.3', '01010107')
) as c(size, strands, stem)
where p.brand = 'RR Kabel' and p.sku like 'RR-SFR-%'
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.size::numeric;

-- ── 4. KEI Conflame: enrich construction detail (name already correct) ──
update public.products set
  spec = split_part(attrs->>'Size', ' ', 1) || ' sq mm · single core · multi-strand annealed copper (IS 8130) · '
         || coalesce(nullif(trim(attrs->>'Length'), ''), '90 m') || ' coil · FR PVC · 1100 V · IS 694'
where brand = 'KEI' and category = 'Wires & Cables'
  and sku like 'KEI-FR-%' and attrs->>'Size' is not null;

-- Review: line names, grades, brand SKUs per brand
select brand, attrs->>'Quality' as grade, count(*) as skus,
       count(brand_sku) as with_brand_sku, min(name) as sample_name, min(spec) as sample_spec
from public.products
where category = 'Wires & Cables'
group by brand, attrs->>'Quality'
order by brand, grade;
