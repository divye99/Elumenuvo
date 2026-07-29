-- ═══════════════════════════════════════════════════════════════
-- 0074: retire the Polycab GreenWire FR range (36 listings).
--
-- Every GreenWire FR size+colour has an FRLS twin at the same selling price,
-- which made the catalogue read as duplicate listings (both were even holding
-- a #1 trophy from different guides). None of the 36 FR rows has ever sold.
-- Deactivated, not deleted, so they can be restored if the FR range is ever
-- stocked as a distinct product line again.
-- ═══════════════════════════════════════════════════════════════

update public.products
set is_active = false
where id like 'wire-polycab-fr-%'        -- FRLS ids are 'wire-polycab-frls-%'
  and id not like 'wire-polycab-frls-%';

select count(*) as deactivated from public.products
where id like 'wire-polycab-fr-%' and id not like 'wire-polycab-frls-%' and is_active = false;
