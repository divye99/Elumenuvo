-- ═══════════════════════════════════════════════════════════════
-- 0048 · Daily price snapshots (ours + competitors), change or no change
--
-- The product page's price history only had points when something HAPPENED
-- (an admin price edit, a competitor sync), so most charts showed a single
-- dot. Per user decision (Jul 2026):
--   1. Mapped products log OUR price and every approved competitor's price
--      daily; the storefront shows competitors as the AVG market price.
--   2. Unmapped products log our price daily.
--
-- log_daily_prices() is idempotent per UTC day (safe to call repeatedly; the
-- Vercel cron calls it once a day) and is executable by the service role only.
-- The final SELECT backfills today's snapshot immediately.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.log_daily_prices()
returns table (products_logged int, competitor_rows_logged int)
language plpgsql
security definer
set search_path = public
as $$
declare
  n_products int;
  n_comp int;
begin
  -- 1. Our price: one row per active product per UTC day.
  insert into public.price_history (product_id, elume_price, mrp)
  select p.id, p.elume_price, p.mrp
  from public.products p
  where p.is_active
    and not exists (
      select 1 from public.price_history h
      where h.product_id = p.id and h.captured_at >= date_trunc('day', now())
    );
  get diagnostics n_products = row_count;

  -- 2. Competitor prices: the current snapshot of every APPROVED, buyable
  --    mapping, one row per (product, source) per UTC day. Copying the
  --    snapshot daily is exactly what "log it even if it has not changed"
  --    means; unavailable/out-of-stock listings are skipped so a dead listing
  --    cannot drag the market average.
  insert into public.competitor_price_history (product_id, source, list_price, net_price, comparable_price, our_price)
  select cp.product_id, cp.source, cp.list_price, cp.net_price, cp.comparable_price, p.elume_price
  from public.competitor_prices cp
  join public.competitor_map m
    on m.product_id = cp.product_id and m.source = cp.source and m.approval = 'approved'
  join public.products p on p.id = cp.product_id and p.is_active
  where cp.comparable_price > 0
    and coalesce(cp.in_stock, true)
    and not exists (
      select 1 from public.competitor_price_history h
      where h.product_id = cp.product_id and h.source = cp.source
        and h.captured_at >= date_trunc('day', now())
    );
  get diagnostics n_comp = row_count;

  return query select n_products, n_comp;
end;
$$;

revoke all on function public.log_daily_prices() from public, anon, authenticated;
grant execute on function public.log_daily_prices() to service_role;

-- Backfill today's snapshot right now so every chart gains a point immediately.
select * from public.log_daily_prices();
