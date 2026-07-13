-- ═══════════════════════════════════════════════════════════════
-- 0034 · KEI house-wire lines corrected from the official catalogue
--
-- Source: KEI House Wires catalogue 2024 (kei-ind.com), user-supplied. KEI's
-- real marking names per insulation grade:
--   FR            → HOMECAB          (FR PVC, anti-rodent, lead free, COI >29%)
--   FR-LSH        → CONFLAME         (FR-LSH PVC, COI >29%, temp index 250°C)
--   HR FR-LSH     → CONFLAME GREEN+  (HR FR-LSH LF, 85°C, COI >31%, +20% current)
--   HFFR          → BANFIRE          (halogen-free, 70°C, zero toxic fumes)
-- Strand construction (same across lines): 0.5→16/0.2 0.75→24/0.2 1→32/0.2
--   1.5→30/0.25 2.5→50/0.25 4→56/0.3 6→84/0.3. Packing 90 m cartons.
--
-- Our data had the grade families named "KEI Homecab <GRADE>" for ALL grades
-- (only FR was actually HomeCab) plus an older duplicate "Conflame FR Wire"
-- seed (FR grade, no colour, sizes 1.0/1.5/2.5/4.0). This migration renames
-- each family to its true KEI line, sets the grade attr, and rebuilds the spec
-- with catalogue construction detail. MRPs untouched. No per-size KEI item
-- codes exist in this catalogue, so brand_sku is left for a KEI price list.
--
-- The old dotted "Conflame FR Wire" seed IS the FR/HomeCab grade, so it's
-- folded into HomeCab FR naming; it now DUPLICATES the KEI-FR-*-BL colour
-- family (flagged for the user - consider removing the dotted rows). Idempotent.
-- ═══════════════════════════════════════════════════════════════

-- Strand construction lookup, reused by every line below.
create temporary table _kei_strands (size numeric primary key, strands text) on commit drop;
insert into _kei_strands values
  (0.5,'16/0.2'), (0.75,'24/0.2'), (1,'32/0.2'), (1.5,'30/0.25'),
  (2.5,'50/0.25'), (4,'56/0.3'), (6,'84/0.3');

-- ── 1. HomeCab (FR) - name already right, fix grade + enrich spec ──
update public.products p set
  attrs = jsonb_set(coalesce(p.attrs,'{}'::jsonb), '{Quality}', '"FR"'),
  spec = split_part(p.attrs->>'Size',' ',1) || ' sq mm · single core · ' || s.strands
       || ' strand bright annealed copper · 90 m coil · FR PVC · COI >29% · anti-rodent · lead free · 1100 V · IS 694'
from _kei_strands s
where p.brand='KEI' and p.name like 'KEI Homecab FR %'
  and split_part(p.attrs->>'Size',' ',1)::numeric = s.size;

-- ── 2. Conflame (FR-LSH) - was mislabeled "Homecab FRLSH" ──
update public.products p set
  name = replace(p.name, 'KEI Homecab FRLSH', 'KEI Conflame FR-LSH'),
  attrs = jsonb_set(coalesce(p.attrs,'{}'::jsonb), '{Quality}', '"FR-LSH"'),
  spec = split_part(p.attrs->>'Size',' ',1) || ' sq mm · single core · ' || s.strands
       || ' strand bright annealed copper · 90 m coil · FR-LSH PVC · COI >29% · temp index 250°C · lead free · 1100 V · IS 694'
from _kei_strands s
where p.brand='KEI' and p.name like '%Homecab FRLSH%'
  and split_part(p.attrs->>'Size',' ',1)::numeric = s.size;

-- ── 3. Conflame Green+ (HR FR-LSH) - was mislabeled "Homecab HRFR" ──
update public.products p set
  name = replace(p.name, 'KEI Homecab HRFR', 'KEI Conflame Green+ HR FR-LSH'),
  attrs = jsonb_set(coalesce(p.attrs,'{}'::jsonb), '{Quality}', '"HR FR-LSH"'),
  spec = split_part(p.attrs->>'Size',' ',1) || ' sq mm · single core · ' || s.strands
       || ' strand bright annealed copper · 90 m coil · HR FR-LSH LF PVC · 85°C · COI >31% · +20% current · lead free · 1100 V · IS 694'
from _kei_strands s
where p.brand='KEI' and p.name like '%Homecab HRFR%'
  and split_part(p.attrs->>'Size',' ',1)::numeric = s.size;

-- ── 4. Banfire (HFFR) - was mislabeled "Homecab HFFR" ──
update public.products p set
  name = replace(p.name, 'KEI Homecab HFFR', 'KEI Banfire HFFR'),
  attrs = jsonb_set(coalesce(p.attrs,'{}'::jsonb), '{Quality}', '"HFFR"'),
  spec = split_part(p.attrs->>'Size',' ',1) || ' sq mm · single core · ' || s.strands
       || ' strand bright annealed copper · 90 m coil · HFFR halogen-free · 70°C · zero toxic fumes · lead free · 1100 V · IS 694'
from _kei_strands s
where p.brand='KEI' and p.name like '%Homecab HFFR%'
  and split_part(p.attrs->>'Size',' ',1)::numeric = s.size;

-- ── 5. Old "Conflame FR Wire" seed IS the FR (HomeCab) grade - align it ──
update public.products p set
  name = 'KEI Homecab FR ' || split_part(p.attrs->>'Size',' ',1) || ' sq mm House Wire',
  attrs = jsonb_set(coalesce(p.attrs,'{}'::jsonb), '{Quality}', '"FR"'),
  spec = split_part(p.attrs->>'Size',' ',1) || ' sq mm · single core · ' || s.strands
       || ' strand bright annealed copper · 90 m coil · FR PVC · COI >29% · anti-rodent · lead free · 1100 V · IS 694'
from _kei_strands s
where p.brand='KEI' and p.name like 'Conflame FR Wire%'
  and split_part(p.attrs->>'Size',' ',1)::numeric = s.size;

-- Review: KEI wire lines after correction
select attrs->>'Quality' as grade, count(*) as skus, min(name) as sample_name, min(spec) as sample_spec
from public.products
where brand='KEI' and category='Wires & Cables'
group by attrs->>'Quality' order by grade;
