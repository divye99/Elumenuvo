-- ═══════════════════════════════════════════════════════════════
-- 0031 · APAR range correction + official list prices (e.f. 21 May 2026)
--
-- Source: APAR's official price list (user-supplied, 21 May 2026). Our three
-- APAR lines were misnamed against APAR's real range:
--
--   sku prefix     our (wrong) name              real APAR line
--   APR-FRPVC      "Anushakti (EBXL HR) FR-PVC"  → APAR SHAKTI FR PVC
--   APR-HRFR       "Anushakti HR-FR-PVC"         → APAR ANUSHAKTI EBXL HR FR PVC
--   APR-HRFRLSH    "Anushakti HR-FR-LSH"         → APAR SHAKTI GREEN WIRE (HR FR-LSH)
--
-- (0029's enrichment stamped EBXL on APR-FRPVC — the wrong line; the EBXL
-- e-beam technology belongs to the true Anushakti, APR-HRFR. Unwound here.)
-- MRPs = "Rate per 90 m coil" from the list. Elume selling prices untouched.
-- All wires get HSN 8544 (per the list) for GST invoicing. Idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. APR-FRPVC → APAR Shakti FR PVC ──
update public.products set
  name = replace(replace(name, 'APAR Anushakti EBXL HR FR-PVC', 'APAR Shakti FR PVC'), 'APAR Anushakti FR-PVC', 'APAR Shakti FR PVC'),
  spec = replace(replace(spec, 'EBXL HR FR-PVC · 105°C', 'FR PVC'), '· FR-PVC', '· FR PVC'),
  attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"FR PVC"')
where brand = 'APAR' and sku like 'APR-FRPVC-%';

update public.products p set mrp = c.mrp
from (values ('0.5', 1600), ('0.75', 2240), ('1', 2870), ('1.5', 4240), ('2.5', 6760), ('4', 10150), ('6', 15000)) as c(size, mrp)
where p.sku like 'APR-FRPVC-' || c.size || '-%';

-- ── 2. APR-HRFR → APAR Anushakti EBXL HR FR PVC (the real Anushakti) ──
update public.products set
  name = replace(name, 'APAR Anushakti HR-FR-PVC', 'APAR Anushakti EBXL HR FR-PVC'),
  spec = replace(spec, '· HR-FR ·', '· EBXL HR FR-PVC · 105°C ·'),
  attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"EBXL HR FR"')
where brand = 'APAR' and sku like 'APR-HRFR-%' and sku not like 'APR-HRFRLSH-%';

update public.products p set mrp = c.mrp
from (values ('0.5', 1830), ('0.75', 2490), ('1', 3190), ('1.5', 4730), ('2.5', 7500), ('4', 11230), ('6', 16600)) as c(size, mrp)
where p.sku like 'APR-HRFR-' || c.size || '-%';

-- ── 3. APR-HRFRLSH → APAR Shakti Green Wire (HR FR-LSH) ──
update public.products set
  name = replace(name, 'APAR Anushakti HR-FR-LSH', 'APAR Shakti Green Wire HR FR-LSH'),
  spec = replace(spec, '· HR-FR-LSH ·', '· HR FR-LSH (Green Wire) ·'),
  attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Quality}', '"HR FR-LSH"')
where brand = 'APAR' and sku like 'APR-HRFRLSH-%';

update public.products p set mrp = c.mrp
from (values ('0.5', 1700), ('0.75', 2390), ('1', 3080), ('1.5', 4530), ('2.5', 7230), ('4', 10950), ('6', 16190)) as c(size, mrp)
where p.sku like 'APR-HRFRLSH-' || c.size || '-%';

-- ── 4. HSN code for GST invoicing — all house wires are HSN 8544 ──
update public.products
set attrs = jsonb_set(coalesce(attrs, '{}'::jsonb), '{HSN}', '"8544"')
where category = 'Wires & Cables' and (attrs is null or attrs->>'HSN' is null);

-- Review: line × size with the new MRPs and the discount our price now gives
-- (Size is text like "4 sq mm" — order by its leading number, don't cast raw.)
select split_part(sku, '-', 2) as line, attrs->>'Size' as size,
       min(mrp) as mrp, min(elume_price) as elume,
       round(100 * (1 - min(elume_price) / min(mrp))) as off_pct, count(*) as colours
from public.products where brand = 'APAR'
group by 1, 2 order by 1, split_part(attrs->>'Size', ' ', 1)::numeric;
