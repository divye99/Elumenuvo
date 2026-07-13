-- ═══════════════════════════════════════════════════════════════
-- 0029 · Wire catalogue detail enrichment
--
-- House-wire listings were under-specified, which (a) undersold the product
-- (APAR Anushakti is e-beam cross-linked HR FR PVC — the listing just said
-- "FR-PVC") and (b) starved the auto-matcher of the tokens it needs to tell
-- products apart (core count, insulation grade).
--
--   1. APAR Anushakti → full verified identity: EBXL HR FR PVC, 105°C,
--      IS 694:2010 (source: aparwiresandcables.com + dealer listings).
--   2. Every house wire → explicit "single core" + "IS 694" in the spec.
-- Idempotent — every update is guarded against double application.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. APAR Anushakti: EBXL HR FR PVC (verified) ──
update public.products
set name = replace(name, 'Anushakti FR-PVC', 'Anushakti EBXL HR FR-PVC'),
    spec = replace(spec, 'FR-PVC', 'EBXL HR FR-PVC · 105°C'),
    attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"EBXL HR FR"')
where brand = 'APAR'
  and category = 'Wires & Cables'
  and name like '%Anushakti FR-PVC%';

-- ── 2. All house wires: make "single core" explicit (they all are) ──
update public.products
set spec = 'single core · ' || spec
where category = 'Wires & Cables'
  and spec is not null
  and spec not ilike '%core%';

-- ── 3. All house wires: cite the standard (IS 694) ──
update public.products
set spec = spec || ' · IS 694'
where category = 'Wires & Cables'
  and spec is not null
  and spec not ilike '%IS 694%';

-- Review: one row per brand/grade family
select brand, attrs->>'Quality' as quality, count(*) as products,
       min(spec) as sample_spec
from public.products
where category = 'Wires & Cables'
group by brand, attrs->>'Quality'
order by brand, quality;
