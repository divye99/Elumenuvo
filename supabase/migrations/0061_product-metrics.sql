-- ═══════════════════════════════════════════════════════════════
-- 0061: Product metrics warehouse (Amazon-style Glance Views, conversion,
-- ASP) captured per product per IST day, forever.
--
--   Glance Views      = human pageviews of a product detail page
--   Conversion Rate   = units (or orders) / glance_views, computed at query time
--   ASP               = revenue / units, computed at query time
--
-- Dimensions (name, brand, category, price, mrp) are SNAPSHOTTED into each
-- row, so future slicing by brand / category / price band survives product
-- edits and deletions. Deeper cuts (attrs, price bands, brand x category)
-- are derivable at query time; this table is the raw layer an intelligence
-- tool can be built on later.
--
-- Populated two ways, both through one idempotent function:
--   * this migration backfills ALL history from site_events + orders
--   * a daily Vercel cron re-rolls the last few days (late events, edits)
-- Safe to re-run: rows are upserted per (day, product_id).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.product_metrics_daily (
  day            date    not null,              -- IST calendar day
  product_id     text    not null,              -- products.id (kept even after deletion)
  -- dimension snapshot at rollup time
  name           text,
  brand          text,
  category       text,
  price          numeric(12,2),                 -- our listed elume_price that day
  mrp            numeric(12,2),
  -- metrics
  glance_views   int     not null default 0,    -- human PDP pageviews
  unique_viewers int     not null default 0,    -- distinct devices (sid) among those views
  cart_adds      int     not null default 0,    -- add-to-cart clicks on the PDP
  units          numeric not null default 0,    -- units ordered (paid orders; later cancellations still count as ordered)
  orders         int     not null default 0,    -- distinct paid orders containing the product
  revenue        numeric(14,2) not null default 0, -- sum(qty x item selling price); order-level discount codes not netted out
  updated_at     timestamptz not null default now(),
  primary key (day, product_id)
);

-- Service-role only, like orders/site_events: RLS on, no anon policies.
alter table public.product_metrics_daily enable row level security;

create index if not exists pmd_product_idx  on public.product_metrics_daily (product_id, day);
create index if not exists pmd_category_idx on public.product_metrics_daily (category);
create index if not exists pmd_brand_idx    on public.product_metrics_daily (brand);

-- ───────────────────────────────────────────────────────────────
-- The rollup. Re-computes every (day, product) row in [from_day, to_day]
-- (IST days) from the raw sources and upserts. Dim snapshots only overwrite
-- with non-null values, so a product deleted later keeps its last-known dims.
-- ───────────────────────────────────────────────────────────────
create or replace function public.rollup_product_metrics(from_day date, to_day date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  with
  views as (
    -- PDP pageviews: /catalogue/<product_id>, bots excluded by user agent
    -- (same regex as the admin analytics classifier).
    select
      (created_at at time zone 'Asia/Kolkata')::date as day,
      split_part(split_part(split_part(path, '?', 1), '#', 1), '/', 3) as pid,
      sid
    from site_events
    where type = 'pageview'
      and path like '/catalogue/%'
      and (created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
      and coalesce(ua, '') !~* 'bot|crawl|spider|slurp|headless|lighthouse|preview|python|curl|wget|axios|node-fetch|go-http|ahrefs|semrush|petalbot|bytespider|yandex|applebot|gptbot|perplexity|ccbot|dataforseo|screaming'
  ),
  view_agg as (
    select day, pid, count(*) as glance_views, count(distinct sid) as unique_viewers
    from views
    where pid <> ''
    group by day, pid
  ),
  cart_agg as (
    -- Add-to-cart clicks fired while ON a PDP (listing-page quick adds have
    -- no product in the path and are skipped).
    select
      (created_at at time zone 'Asia/Kolkata')::date as day,
      split_part(split_part(split_part(path, '?', 1), '#', 1), '/', 3) as pid,
      count(*) as cart_adds
    from site_events
    where type = 'add_to_cart'
      and path like '/catalogue/%'
      and (created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
    group by 1, 2
  ),
  sale_agg as (
    -- Ordered units from PAID orders (awaiting_payment / payment_abandoned
    -- never count). Item price is the actual selling price on the order.
    select
      (o.created_at at time zone 'Asia/Kolkata')::date as day,
      it->>'id' as pid,
      sum(coalesce((it->>'qty')::numeric, 0)) as units,
      count(distinct o.id) as orders,
      sum(coalesce((it->>'qty')::numeric, 0) * coalesce((it->>'price')::numeric, 0)) as revenue
    from orders o
    cross join lateral jsonb_array_elements(coalesce(o.items, '[]'::jsonb)) it
    where o.status not in ('awaiting_payment', 'payment_abandoned')
      and (o.created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
      and coalesce(it->>'id', '') <> ''
    group by 1, 2
  ),
  merged as (
    select
      coalesce(v.day, c.day, s.day) as day,
      coalesce(v.pid, c.pid, s.pid) as pid,
      coalesce(v.glance_views, 0)   as glance_views,
      coalesce(v.unique_viewers, 0) as unique_viewers,
      coalesce(c.cart_adds, 0)      as cart_adds,
      coalesce(s.units, 0)          as units,
      coalesce(s.orders, 0)         as orders,
      coalesce(s.revenue, 0)        as revenue
    from view_agg v
    full outer join cart_agg c on c.day = v.day and c.pid = v.pid
    full outer join sale_agg s on s.day = coalesce(v.day, c.day) and s.pid = coalesce(v.pid, c.pid)
  )
  insert into product_metrics_daily as t
    (day, product_id, name, brand, category, price, mrp,
     glance_views, unique_viewers, cart_adds, units, orders, revenue, updated_at)
  select
    m.day, m.pid, p.name, p.brand, p.category, p.elume_price, p.mrp,
    m.glance_views, m.unique_viewers, m.cart_adds, m.units, m.orders, m.revenue, now()
  from merged m
  left join products p on p.id = m.pid
  on conflict (day, product_id) do update set
    name           = coalesce(excluded.name,     t.name),
    brand          = coalesce(excluded.brand,    t.brand),
    category       = coalesce(excluded.category, t.category),
    price          = coalesce(excluded.price,    t.price),
    mrp            = coalesce(excluded.mrp,      t.mrp),
    glance_views   = excluded.glance_views,
    unique_viewers = excluded.unique_viewers,
    cart_adds      = excluded.cart_adds,
    units          = excluded.units,
    orders         = excluded.orders,
    revenue        = excluded.revenue,
    updated_at     = now();

  get diagnostics n = row_count;
  return n;
end;
$$;

-- Only the server (service role) may run the rollup.
revoke execute on function public.rollup_product_metrics(date, date) from public, anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- Backfill everything we have ever captured (site_events began 0051,
-- orders earlier; 2026-01-01 predates both).
-- ───────────────────────────────────────────────────────────────
select public.rollup_product_metrics(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as rows_backfilled;

select 'product metrics warehouse ready' as status;
