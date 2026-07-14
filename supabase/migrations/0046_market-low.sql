-- ═══════════════════════════════════════════════════════════════
-- 0046 · products.market_low — the lowest trusted competitor price
--
-- "Today's best prices" on the home page ranked by % off MRP, which the
-- Havells import made meaningless: MRPs are manufacturer theatre and the
-- import's uniform discounts make whole ranges tie. The honest signal the
-- pricing intelligence now has is: WHERE DO WE BEAT THE LOWEST SELLER?
--
-- market_low = min(comparable_price) across sellers whose mapping is
-- APPROVED, whose listing is in stock, with a real >0 price — the same
-- "buyable" rule Price Radar uses. It lives on products (anon-readable) so
-- the storefront can rank by it without exposing the competitor tables.
--
-- Kept fresh by refresh_market_low(), called from the price sync and from
-- mapping approve/reject/remove. Run AFTER 0043 (it backfills from those
-- snapshots).
-- ═══════════════════════════════════════════════════════════════

alter table public.products
  add column if not exists market_low numeric;

comment on column public.products.market_low is
  'Lowest buyable competitor price (approved mapping, in stock, >0), maintained by refresh_market_low(). Null = no trusted competitor price.';

-- One maintainer for the value, callable for specific ids or the whole
-- catalogue (ids => null). SECURITY DEFINER so the server-side sync can call
-- it via RPC without table-level update grants leaking elsewhere.
create or replace function public.refresh_market_low(ids text[] default null)
returns void
language sql
security definer
set search_path = public
as $$
  with low as (
    select cp.product_id, min(cp.comparable_price) as low
    from public.competitor_prices cp
    join public.competitor_map m
      on m.product_id = cp.product_id and m.source = cp.source
    where m.approval = 'approved'
      and coalesce(cp.in_stock, true)
      and cp.comparable_price > 0
      and (ids is null or cp.product_id = any(ids))
    group by cp.product_id
  )
  update public.products p
  set market_low = low.low
  from low
  where p.id = low.product_id
    and p.market_low is distinct from low.low;

  -- Products that LOST their last trusted price (mapping rejected, listing
  -- went out of stock everywhere) must fall back to null, not keep a stale low.
  update public.products p
  set market_low = null
  where (ids is null or p.id = any(ids))
    and p.market_low is not null
    and not exists (
      select 1
      from public.competitor_prices cp
      join public.competitor_map m
        on m.product_id = cp.product_id and m.source = cp.source
      where cp.product_id = p.id
        and m.approval = 'approved'
        and coalesce(cp.in_stock, true)
        and cp.comparable_price > 0
    );
$$;

revoke all on function public.refresh_market_low(text[]) from public, anon, authenticated;
grant execute on function public.refresh_market_low(text[]) to service_role;

-- Backfill the whole catalogue from the snapshots already in place.
select public.refresh_market_low(null);

-- Sanity: how many products now have a trusted market low
select count(*) as products_with_market_low from public.products where market_low is not null;
