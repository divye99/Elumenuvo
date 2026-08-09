-- 0099: Photos for the 35 imageless APAR products (all of them the
-- Shakti Green Wire HR FR-LSH series, 5 colours x 7 sizes).
--
-- Source: APAR's official series packshot from aparwiresandcables.com
-- (Green Wire HR FR-LSH PVC product page), rehosted to our storage:
-- product-images/all/apar-shakti-green-hrfrlsh-official.webp (76 KB webp).
-- No public per-colour photo set exists for this series, so every variant
-- gets the correct official series packshot - same practice as the rest of
-- the APAR range, which shares series-level shots across colours.
-- Idempotent, and only fills rows that still have no photo.

update public.products
  set image_url = 'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/all/apar-shakti-green-hrfrlsh-official.webp'
  where brand = 'APAR'
    and name like '%Shakti Green Wire HR FR-LSH%'
    and image_url is null;
