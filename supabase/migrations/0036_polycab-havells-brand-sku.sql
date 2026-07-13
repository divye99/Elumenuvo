-- ═══════════════════════════════════════════════════════════════
-- 0036 · Brand SKUs for Polycab + Havells house wires (from catalogues)
--
-- Codes extracted from the official catalogues already on hand:
--   Polycab House Wires Catalogue (Mar-25): per-size product codes. The code
--     distinguishes low-smoke (…YUAYL…, Maxima+ Green Wire HR FR-LSH) from FR
--     (…YUAYF…, Optima+/Primma/Etira). One code per size, colour-agnostic
--     (matches the existing convention already applied to the FRLS line).
--   Havells Consumer Cable Catalogue: Life Line Plus S3 = basic code stem
--     WHFFDN, Life Guard FR-LSH = WHFFFN, per-size (A1X50…A16X0). Fixed colour
--     letter K + "-C" suffix, colour-agnostic (matches the existing rows).
--
-- Idempotent: re-running writes the same codes. Sizes with no catalogue code
-- (0.5 and 10 sq mm on Polycab) are left null.
-- ═══════════════════════════════════════════════════════════════

-- ── Polycab: low-smoke lines (FRLS, FRLSH, Maxima+ HR FR-LSH) → 'L' code ──
update public.products p set brand_sku = 'LDIS09CYUAYL001C' || c.suf
from (values ('0.75','.75S'),('1','001S'),('1.5','1.5S'),('2.5','2.5S'),('4','004S'),('6','006S')) as c(sz, suf)
where p.brand = 'Polycab' and p.category = 'Wires & Cables'
  and (p.name ilike '%FRLS%' or p.name ilike '%Maxima+%' or p.name ilike '%HR FR-LSH%')
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.sz::numeric;

-- ── Polycab: plain FR line (GreenWire FR, not FRLS) → 'F' code ──
update public.products p set brand_sku = 'LDIS09CYUAYF001C' || c.suf
from (values ('0.75','.75S'),('1','001S'),('1.5','1.5S'),('2.5','2.5S'),('4','004S'),('6','006S')) as c(sz, suf)
where p.brand = 'Polycab' and p.category = 'Wires & Cables'
  and p.name ilike 'Polycab GreenWire FR %' and p.name not ilike '%FRLS%'
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.sz::numeric;

-- ── Havells: Life Line Plus S3 (HRFR) → WHFFDN ──
update public.products p set brand_sku = 'WHFFDNK' || c.code || '-C'
from (values ('0.5','A1X50'),('0.75','A1X75'),('1','A11X0'),('1.5','A11X5'),('2.5','A12X5'),('4','A14X0'),('6','A16X0')) as c(sz, code)
where p.brand = 'Havells' and p.category = 'Wires & Cables' and p.name ilike '%Life Line%'
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.sz::numeric;

-- ── Havells: Life Guard FR-LSH → WHFFFN ──
update public.products p set brand_sku = 'WHFFFNK' || c.code || '-C'
from (values ('0.5','A1X50'),('0.75','A1X75'),('1','A11X0'),('1.5','A11X5'),('2.5','A12X5'),('4','A14X0'),('6','A16X0')) as c(sz, code)
where p.brand = 'Havells' and p.category = 'Wires & Cables' and p.name ilike '%Life Guard%'
  and split_part(p.attrs->>'Size', ' ', 1)::numeric = c.sz::numeric;

-- Review: Polycab + Havells wire brand_sku coverage after this migration
select brand, count(*) as skus, count(brand_sku) as with_brand_sku
from public.products
where category = 'Wires & Cables' and brand in ('Polycab','Havells')
group by brand order by brand;
