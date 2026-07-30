-- ═══════════════════════════════════════════════════════════════
-- 0075: remove em-dashes from all product-facing text.
--
-- House naming used "Name — Variant · Size"; the variant separator becomes
-- the same middle dot as the size separator: "Name · Variant · Size".
-- Spec strings get the same treatment. Old order snapshots keep whatever
-- name they were bought under (they are historical records).
-- ═══════════════════════════════════════════════════════════════

update public.products set name = replace(name, ' — ', ' · ') where name like '%—%';
update public.products set name = replace(name, '—', '-')     where name like '%—%';
update public.products set spec = replace(spec, ' — ', ' · ') where spec like '%—%';
update public.products set spec = replace(spec, '—', '-')     where spec like '%—%';

select count(*) as names_still_with_emdash from public.products where name like '%—%' or spec like '%—%';
