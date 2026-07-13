-- ═══════════════════════════════════════════════════════════════
-- 0032 · Canonical, complete specs for every house-wire SKU
--
-- Polycab / KEI / RR / Finolex / Havells / CMI wire specs had drifted into
-- inconsistent fragments (0029 prepended "single core" and appended "IS 694"
-- around whatever was there, leaving things like
-- "single core · 90 m coil · 1100 V · red · IS 694" with the colour stranded
-- mid-string). Rebuild each spec from the product's own attributes into one
-- canonical, complete line:
--
--   <size> · single core copper · <length> coil · <grade> PVC · 1100 V · IS 694
--
-- Colour stays in the product name + Colour attribute (not in the spec).
-- APAR is excluded: 0031 already wrote its verified line-specific specs.
-- Idempotent: re-running recomputes the same string.
-- ═══════════════════════════════════════════════════════════════

update public.products
set spec = concat_ws(' · ',
  attrs->>'Size',
  'single core copper',
  coalesce(nullif(trim(attrs->>'Length'), ''), '90 m') || ' coil',
  case
    when coalesce(trim(attrs->>'Quality'), '') = '' then null
    when upper(attrs->>'Quality') like '%PVC%' then attrs->>'Quality'
    else (attrs->>'Quality') || ' PVC'
  end,
  '1100 V',
  'IS 694'
)
where category = 'Wires & Cables'
  and brand <> 'APAR'
  and attrs->>'Size' is not null;

-- Review: one sample spec per brand + grade
select brand, attrs->>'Quality' as grade, count(*) as skus, min(spec) as sample_spec
from public.products
where category = 'Wires & Cables'
group by brand, attrs->>'Quality'
order by brand, grade;
