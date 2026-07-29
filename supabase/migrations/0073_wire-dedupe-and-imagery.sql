-- ═══════════════════════════════════════════════════════════════
-- 0073: wire catalogue cleanup + official brand imagery.
--
-- 1. DEDUPE. 0072 was generated from the demand CSV before checking the
--    existing wire ranges thoroughly enough: the catalogue already stocks
--    KEI Homecab / Conflame / Conflame Green+ (172 listings) and RR Kabel
--    Superex (4). The 0072 rows that duplicate them are removed; kept are
--    the genuinely new ones (KEI 10/16 sq mm, the 45 m Conflame, and all
--    13 Anchor wires). Safe to run whether or not 0072 was applied.
--
-- 2. IMAGERY. Official KEI packshots extracted from KEI's own 2024 house-wire
--    catalogue and rehosted locally:
--      /products/kei-homecab-fr.jpg           (Homecab-FR box)
--      /products/kei-conflame-green-plus.jpg  (conFlame Green+ box)
--      /products/kei-banfire-hffr.jpg         (banFire-HFFR box)
--    Applied to every KEI wire listing without an image. Anchor has no
--    clean official packshot available programmatically; those keep the
--    category tile until distributor assets arrive.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Remove 0072 duplicates of already-stocked wires ──
delete from public.products where id in (
  'kei-homecab-0p5-90','kei-homecab-0p75-90-red',
  'kei-homecab-1-90-red',
  'kei-homecab-1p5-90-red','kei-homecab-1p5-90-black',
  'kei-homecab-2p5-90-red','kei-homecab-2p5-90-black','kei-homecab-2p5-90-green',
  'kei-homecab-4-90','kei-homecab-6-90',
  'kei-conflame-green-plus-1-90-green','kei-conflame-green-plus-1p5-90-green','kei-conflame-green-plus-2p5-90-green',
  'rrk-superex-1-90','rrk-superex-2p5-90','rrk-superex-4-90'
);

-- ── 2. Official KEI imagery for every KEI wire without one ──
update public.products set image_url = '/products/kei-homecab-fr.jpg'
where brand = 'KEI' and category = 'Wires & Cables'
  and (image_url is null or image_url = '') and name ilike '%homecab%';

update public.products set image_url = '/products/kei-conflame-green-plus.jpg'
where brand = 'KEI' and category = 'Wires & Cables'
  and (image_url is null or image_url = '') and name ilike '%conflame%';

update public.products set image_url = '/products/kei-banfire-hffr.jpg'
where brand = 'KEI' and category = 'Wires & Cables'
  and (image_url is null or image_url = '') and name ilike '%banfire%';

-- Verification
select brand,
       count(*) as wires,
       count(*) filter (where image_url is not null and image_url <> '') as with_image
from public.products
where category = 'Wires & Cables' and brand in ('KEI','RR Kabel','Anchor')
group by 1 order by 1;
