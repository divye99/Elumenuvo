-- ═══════════════════════════════════════════════════════════════
-- 0050 · Remove the legacy hav-ll-* wire family (stale duplicates)
--
-- hav-ll-10/15/25/40/60 ("Life Line Plus S3 HRFR Wire", seeded in 0002)
-- predate the Jul 2026 Havells catalogue import and duplicate the
-- wire-havells-hrfr-* colour family from 0024, which carries the correct
-- July 2026 list prices. The legacy rows kept their seed-era prices
-- (hav-ll-60 at ₹19,591 vs ₹10,735 real market for the same 6.0 sq mm 90 m
-- coil), forcing gen-elume-wire.mjs to outlier-filter them, and two of them
-- (hav-ll-15/25) carry wrong bestofelectricals mappings: armoured control
-- cable matched to house wire (0022). Deleting beats repricing: repriced,
-- they would still be colourless duplicates competing with the real family.
--
-- The five rows are a self-contained variant family (hav-ll-15 is the parent
-- of the other four; nothing outside the set points at them), so unlike 0045
-- there is no surviving sibling to promote. Same disposal rule as 0045:
-- rows referenced by an order are ARCHIVED (is_active = false, hidden by
-- RLS), the rest deleted. competitor_map / competitor_prices / price_history
-- / reviews all cascade on delete. Idempotent: re-running is a no-op.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Dissolve the variant family (an archived survivor must not remain a
--       child of a deleted or archived parent) ──
update public.products
set parent_id = null
where id in ('hav-ll-10', 'hav-ll-15', 'hav-ll-25', 'hav-ll-40', 'hav-ll-60')
  and parent_id is not null;

-- ── 2. Archive rows that appear in an order (history stays intact) ──
update public.products p
set is_active = false
where p.id in ('hav-ll-10', 'hav-ll-15', 'hav-ll-25', 'hav-ll-40', 'hav-ll-60')
  and p.is_active
  and exists (
    select 1 from public.orders o
    where o.items @> jsonb_build_array(jsonb_build_object('id', p.id))
  );

-- ── 3. Delete the rest (mappings, price snapshots and reviews cascade) ──
delete from public.products p
where p.id in ('hav-ll-10', 'hav-ll-15', 'hav-ll-25', 'hav-ll-40', 'hav-ll-60')
  and not exists (
    select 1 from public.orders o
    where o.items @> jsonb_build_array(jsonb_build_object('id', p.id))
  );

-- Sanity: whatever remains must be archived, order-referenced rows only
select count(*) as remaining_hav_ll, count(*) filter (where is_active) as still_active
from public.products
where id in ('hav-ll-10', 'hav-ll-15', 'hav-ll-25', 'hav-ll-40', 'hav-ll-60');
