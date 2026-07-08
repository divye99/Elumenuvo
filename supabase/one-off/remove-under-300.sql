-- ═══════════════════════════════════════════════════════════════
-- ONE-OFF: remove catalogue products priced under ₹300. NOT a migration.
-- Run by hand in the Supabase SQL editor. DELETE cascades to competitor_map,
-- competitor_prices, price_history (all ON DELETE CASCADE); any variant
-- parent_id pointers are set null automatically.
--
-- 88 products are under ₹300: 69 from the Norisys BOE import + 19 original
-- hand-made products (Anchor, Havells, Legrand, Schneider, GM Modular, ABB,
-- Crompton). STEP 2 removes ALL of them. To keep the 19 originals and only
-- drop the Norisys import, use STEP 2 (Norisys-only) instead.
-- ═══════════════════════════════════════════════════════════════

-- ── STEP 1 — PREVIEW (read-only). Confirm the list before deleting. ──
select brand, count(*) as under_300, min(elume_price) as cheapest, max(elume_price) as dearest
from public.products
where elume_price < 300
group by brand
order by under_300 desc;


-- ── STEP 2 — DELETE everything under ₹300 (all brands, 88 products). ──
delete from public.products where elume_price < 300;


-- ── STEP 2 (alternative) — only the Norisys import, keep the 19 originals. ──
-- delete from public.products where elume_price < 300 and brand = 'Norisys';
