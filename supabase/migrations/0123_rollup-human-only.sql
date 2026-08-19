-- ═══════════════════════════════════════════════════════════════
-- 0123 · Product metrics rollup: India-human-only glance views
--
-- Why: an Aug 2026 residential-proxy crawl wave (Baghdad, Lahore,
-- Guyancourt, Karachi... 74% of a week's sessions) hits the site with
-- SPOOFED desktop user agents, executes JavaScript and even fires the
-- leave-timer beacons. The old rollup filtered only on a UA regex, so
-- these sessions were inflating glance_views / cart_adds in
-- product_metrics_daily, which feeds the EMS merit engine.
--
-- Fix, three parts:
--   1. The UA regex is upgraded to the FULL ingest list (src/lib/bots.ts,
--      keep in lockstep) plus loose agent fragments and Lightpanda.
--   2. Known crawl-fleet IP ranges (Googlebot, Bing) are excluded.
--   3. The hammer: only sessions geolocated to India count. We sell and
--      ship within India; every observed bot in the wave carries foreign
--      geo, while rows with NO geo (old/dev rows predating geo capture)
--      are kept via coalesce so history is not destroyed. Real foreign
--      buyers are not punished anywhere that matters: orders/units/revenue
--      come from the orders table and are untouched by this filter.
--
-- Then the ENTIRE history is re-rolled from raw site_events (never pruned;
-- bot purges 0054/0057 are precedent), after zeroing the traffic columns so
-- (day, product) rows whose views were pure bot traffic do not survive as
-- stale numbers. EMS reads a 5-minute cache; it picks the clean data up on
-- its own.
-- ═══════════════════════════════════════════════════════════════

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
  human_events as (
    -- The single human gate, shared by views and cart adds:
    --   * full bot UA list (mirror of src/lib/bots.ts BOT_RE + loose extras)
    --   * crawl-fleet IPs that execute JS (Googlebot, Bing)
    --   * India-only geo; null geo tolerated for rows predating geo capture
    select
      (created_at at time zone 'Asia/Kolkata')::date as day,
      split_part(split_part(split_part(path, '?', 1), '#', 1), '/', 3) as pid,
      sid,
      type
    from site_events
    where type in ('pageview', 'add_to_cart')
      and path like '/catalogue/%'
      and (created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
      and coalesce(country, 'IN') = 'IN'
      and coalesce(ua, '') !~* 'bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|gtmetrix|preview|facebookexternalhit|whatsapp|telegram|slack|twitter|linkedin|discord|embedly|quora|python|curl|wget|axios|node-fetch|go-http|vercel-screenshot|prerender|google-inspectiontool|googleother|google-read-aloud|google-pagespeed|apis-google|mediapartners|adsbot|feedfetcher|bingpreview|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|bytedance|yandex|applebot|amazonbot|claudebot|gptbot|oai-searchbot|perplexity|ccbot|cohere|anthropic|serpstat|dataforseo|zoominfo|barkrowler|seznam|baiduspider|sogou|360spider|coccoc|duckduckgo|qwant|neevabot|timpibot|awariobot|linkfluence|brandwatch|screaming.?frog|netcraft|expanse|censys|shodan|internetmeasurement|paloalto|masscan|zgrab|lightpanda|scrapy|phantomjs|selenium|puppeteer|playwright|java/|okhttp|libwww'
      and not (
        coalesce(ip, '') like '66.249.%'
        or ip like '157.55.39.%'
        or ip like '207.46.13.%'
        or ip like '40.77.167.%'
      )
  ),
  view_agg as (
    select day, pid, count(*) as glance_views, count(distinct sid) as unique_viewers
    from human_events
    where type = 'pageview' and pid <> ''
    group by day, pid
  ),
  cart_agg as (
    -- Add-to-cart clicks fired while ON a PDP, through the same human gate
    -- (the old rollup had NO filter here at all).
    select day, pid, count(*) as cart_adds
    from human_events
    where type = 'add_to_cart' and pid <> ''
    group by day, pid
  ),
  sale_agg as (
    -- Ordered units from PAID orders. Money is money: no geo or UA filter,
    -- a paying customer counts wherever they browse from.
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

revoke execute on function public.rollup_product_metrics(date, date) from public, anon, authenticated;

-- ── Re-sweep all history with the new gate ──
-- Zero the traffic columns first: a (day, product) row whose views were
-- pure bot traffic yields no row in the re-roll, and would otherwise keep
-- its stale inflated numbers forever. Sales columns are recomputed by the
-- re-roll itself.
update public.product_metrics_daily
set glance_views = 0, unique_viewers = 0, cart_adds = 0, updated_at = now()
where day >= date '2026-01-01';

select public.rollup_product_metrics(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as rows_rerolled;

select 'product metrics are now India-human-only' as status;
