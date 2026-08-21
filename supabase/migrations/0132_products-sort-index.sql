-- 0132: index for the catalogue fill (21 Aug 2026 outage follow-up).
-- Every storefront catalogue refresh (once per 5 minutes per region, and on
-- every admin write) pages the active catalogue in ten 1,000-row chunks
-- ordered by (sort_order, id). Without a matching index each chunk sorts
-- the whole active set again: ten sorts of ~9,000 rows per refresh, which
-- is the single query that stalled longest (37 s) while the instance was
-- starved. With this partial index each chunk is an ordered index walk.
-- Idempotent; safe to re-run.
create index if not exists products_active_sort_idx
  on public.products (sort_order, id)
  where is_active;

analyze public.products;
