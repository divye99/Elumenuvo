-- ═══════════════════════════════════════════════════════════════
-- 0037 · Remove non-real / un-codeable Polycab wire rows
--
-- These 21 rows are the only Polycab house wires with no manufacturer code,
-- and each is genuinely not a real catalogue SKU:
--   • 18 × 0.5 sq mm (FR/FRLS/FRLSH, 3 full colour families): Polycab's House
--     Wires catalogue has no 0.5 sq mm size — synthetic rows.
--   • 1 × 10 sq mm on Maxima+ (poly-frls-100-red): above the house-wire range.
--   • 2 legacy rows: a 3-core flexible cable (not a single-core house wire)
--     and a duplicate generic "PVC Wire 2.5".
--
-- Safety (verified pre-delete): the three 0.5 parents are removed together with
-- all their children (no orphans); the 10 sq mm + PVC-2.5 are extra children of
-- poly25, which stays; none have competitor mappings or appear in any order.
-- FK cascade removes any competitor_map/prices/reviews rows automatically.
-- Idempotent: re-running deletes nothing.
-- ═══════════════════════════════════════════════════════════════

delete from public.products
where brand = 'Polycab' and category = 'Wires & Cables'
  and id in (
    'poly-flex-3c15', 'poly-pvc-25-red', 'poly-frls-100-red',
    'wire-polycab-fr-0p5-red', 'wire-polycab-fr-0p5-yellow', 'wire-polycab-fr-0p5-blue',
    'wire-polycab-fr-0p5-black', 'wire-polycab-fr-0p5-green', 'wire-polycab-fr-0p5-grey',
    'wire-polycab-frls-0p5-red', 'wire-polycab-frls-0p5-yellow', 'wire-polycab-frls-0p5-blue',
    'wire-polycab-frls-0p5-black', 'wire-polycab-frls-0p5-green', 'wire-polycab-frls-0p5-grey',
    'wire-polycab-frlsh-0p5-red', 'wire-polycab-frlsh-0p5-yellow', 'wire-polycab-frlsh-0p5-blue',
    'wire-polycab-frlsh-0p5-black', 'wire-polycab-frlsh-0p5-green', 'wire-polycab-frlsh-0p5-grey'
  );

-- Review: Polycab wire count + brand_sku coverage after cleanup (expect 100%)
select count(*) as polycab_wires,
       count(brand_sku) as with_brand_sku,
       count(*) - count(brand_sku) as still_missing
from public.products
where brand = 'Polycab' and category = 'Wires & Cables';
