-- ═══════════════════════════════════════════════════════════════
-- 0045 · Remove every product selling under ₹300
--
-- User decision (Jul 2026): sub-₹300 items (₹80 modular switches, small
-- lamps...) are not worth carrying. 720 rows at generation time, all from the
-- Havells import: Modular 359, Lighting 231, Switchgear 68, Electrical
-- Accessories 50, DB & Panels 12. The import generator now has a matching
-- MIN_PRICE=300 floor so a catalogue re-run cannot resurrect them.
--
-- Order of operations matters:
--   1. 465 of the doomed rows are variant-family PARENTS. parent_id is
--      "on delete set null", so deleting them first would shatter surviving
--      families into unrelated singletons. The cheapest surviving sibling is
--      promoted to family parent BEFORE any removal.
--   2. Rows referenced by an order are ARCHIVED (is_active=false, hidden by
--      RLS), the rest deleted. competitor_map / competitor_prices / reviews
--      cascade on delete.
--
-- RUN AFTER 0044 if you have it (its mapping inserts reference product ids
-- that this file deletes; running 0045 first would make 0044 fail its FKs).
-- Idempotent: re-running is a no-op once the rows are gone.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Promote a surviving sibling where the family parent is doomed ──
with doomed as (
  select id from public.products where elume_price < 300
),
promo as (
  select c.parent_id as old_parent,
         (array_agg(c.id order by c.elume_price asc, c.id))[1] as new_parent
  from public.products c
  join doomed d on d.id = c.parent_id
  where c.elume_price >= 300
  group by c.parent_id
)
update public.products c
set parent_id = case when c.id = promo.new_parent then null else promo.new_parent end
from promo
where c.parent_id = promo.old_parent
  and c.elume_price >= 300;

-- ── 2. Archive doomed rows that appear in an order (history stays intact) ──
update public.products p
set is_active = false
where p.elume_price < 300
  and p.is_active
  and exists (
    select 1 from public.orders o
    where o.items @> jsonb_build_array(jsonb_build_object('id', p.id))
  );

-- ── 3. Delete the rest ──
delete from public.products p
where p.elume_price < 300
  and not exists (
    select 1 from public.orders o
    where o.items @> jsonb_build_array(jsonb_build_object('id', p.id))
  );

-- Sanity: how many remain (should be only archived, order-referenced rows)
select count(*) as remaining_under_300, count(*) filter (where is_active) as still_active
from public.products where elume_price < 300;
