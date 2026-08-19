-- ═══════════════════════════════════════════════════════════════
-- 0124 · Session bot classifier + rollup on objective evidence
--   (SUPERSEDES 0123's geo filter: if 0123 was skipped, skip it forever;
--    if it was already run, this migration restores what it over-cut.)
--
-- Owner rules this encodes:
--   * A bounce IS a view. A visitor from a Google listing who opens one
--     page, touches nothing and leaves is a REAL view and must count.
--   * Foreign interest IS interest. No India-only filter anywhere.
--   * Bots are excluded on OBJECTIVE machine evidence only.
--
-- The evidence (verified on live data, Aug 2026 proxy-crawl wave):
--   ua      known bot/agent strings (mirror of src/lib/bots.ts)
--   ip      crawl-fleet ranges that execute JS (Googlebot, Bing)
--   stale   frozen browser versions: the wave ships Chrome 118-121 and
--           Firefox 120-121 (late 2023) while every engaged human session
--           runs current builds (~151/153). Real browsers auto-update.
--           Also Windows 7 era UAs (NT 6.x). BUMP THE THRESHOLDS ~YEARLY
--           (current major minus ~25); keep in lockstep with
--           STALE_BROWSER_MAX in src/lib/bots.ts.
--   fleet   the same exact UA string across 8+ sessions in the window,
--           not one of which ever engaged
--   heavy   10+ pageviews with zero taps, zero dwell, zero carts
-- An ENGAGED session (identified, added to cart, or tapped + measured
-- dwell) is NEVER a bot, whatever its browser or location.
--
-- Architecture: classify_bot_sessions() writes verdicts into bot_sessions;
-- rollup_product_metrics() excludes those sids. The nightly cron calls
-- classify first, then rollup. This migration classifies ALL history, then
-- zeroes traffic columns and re-rolls everything clean.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bot_sessions (
  sid        text primary key,
  reason     text not null,
  created_at timestamptz not null default now()
);
alter table public.bot_sessions enable row level security; -- service-role only

create or replace function public.classify_bot_sessions(from_day date, to_day date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  create temp table _sess on commit drop as
  with sess as (
    select
      sid,
      max(ua) as ua,
      count(*) filter (where type = 'pageview') as pv,
      count(*) filter (where type in ('click', 'product_click')) as clicks,
      count(*) filter (where type = 'add_to_cart') as carts,
      coalesce(sum(duration_ms) filter (where type = 'leave'), 0) as ms,
      bool_or(type = 'identify') as identified,
      bool_or(
        coalesce(ip, '') like '66.249.%'
        or ip like '157.55.39.%'
        or ip like '207.46.13.%'
        or ip like '40.77.167.%'
      ) as crawl_ip
    from site_events
    where (created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
    group by sid
  )
  select
    s.*,
    (s.identified or s.carts > 0 or (s.clicks > 0 and s.ms > 0)) as engaged,
    coalesce(s.ua ~* 'bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|gtmetrix|preview|facebookexternalhit|whatsapp|telegram|slack|twitter|linkedin|discord|embedly|quora|python|curl|wget|axios|node-fetch|go-http|vercel-screenshot|prerender|google-inspectiontool|googleother|google-read-aloud|google-pagespeed|apis-google|mediapartners|adsbot|feedfetcher|bingpreview|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|bytedance|yandex|applebot|amazonbot|claudebot|gptbot|oai-searchbot|perplexity|ccbot|cohere|anthropic|serpstat|dataforseo|zoominfo|barkrowler|seznam|baiduspider|sogou|360spider|coccoc|duckduckgo|qwant|neevabot|timpibot|awariobot|linkfluence|brandwatch|screaming.?frog|netcraft|expanse|censys|shodan|internetmeasurement|paloalto|masscan|zgrab|lightpanda|scrapy|phantomjs|selenium|puppeteer|playwright|java/|okhttp|libwww', false) as ua_bot,
    coalesce((regexp_match(s.ua, 'Chrome/(\d+)'))[1]::int < 125, false)
      or coalesce((regexp_match(s.ua, 'Firefox/(\d+)'))[1]::int < 125, false)
      or coalesce((regexp_match(s.ua, 'rv:(\d+)'))[1]::int < 125, false)
      or (s.ua ~ 'iPhone|iPad' and coalesce((regexp_match(s.ua, 'OS (\d+)_'))[1]::int < 16, false))
      or (s.ua !~ 'iPhone|iPad' and coalesce((regexp_match(s.ua, 'Version/(\d+)[.0-9]* .*Safari'))[1]::int < 16, false))
      or coalesce(s.ua ~ 'Windows NT 6\.', false) as stale
  from sess s;

  -- A session that has since engaged is a human forever: clear old verdicts.
  delete from bot_sessions b using _sess s where b.sid = s.sid and s.engaged;

  with fleet as (
    select ua from _sess
    where ua is not null
    group by ua
    having count(*) >= 8 and bool_and(not engaged)
  )
  insert into bot_sessions (sid, reason)
  select
    s.sid,
    case
      when s.crawl_ip then 'crawl-ip'
      when s.ua_bot then 'bot-ua'
      when s.stale then 'stale-browser'
      when s.ua in (select ua from fleet) then 'fleet-ua'
      else 'heavy-crawl'
    end
  from _sess s
  where not s.engaged
    and (
      s.crawl_ip
      or s.ua_bot
      or s.stale
      or s.ua in (select ua from fleet)
      or (s.pv >= 10 and s.clicks = 0 and s.ms = 0 and s.carts = 0)
    )
  on conflict (sid) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.classify_bot_sessions(date, date) from public, anon, authenticated;

-- ── Rollup v3: humans decided by bot_sessions, NO geo filter ──
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
    -- One human gate for views and cart adds: not a classified bot session.
    -- Run classify_bot_sessions over the same window first (the cron does).
    -- No country filter: a bounce is a view, foreign interest is interest.
    select
      (created_at at time zone 'Asia/Kolkata')::date as day,
      split_part(split_part(split_part(path, '?', 1), '#', 1), '/', 3) as pid,
      sid,
      type
    from site_events e
    where type in ('pageview', 'add_to_cart')
      and path like '/catalogue/%'
      and (created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
      and not exists (select 1 from bot_sessions b where b.sid = e.sid)
  ),
  view_agg as (
    select day, pid, count(*) as glance_views, count(distinct sid) as unique_viewers
    from human_events
    where type = 'pageview' and pid <> ''
    group by day, pid
  ),
  cart_agg as (
    select day, pid, count(*) as cart_adds
    from human_events
    where type = 'add_to_cart' and pid <> ''
    group by day, pid
  ),
  sale_agg as (
    -- Money is money: paid orders count with no filters of any kind.
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

-- ── Classify all history, then re-roll everything clean ──
select public.classify_bot_sessions(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as sessions_flagged;

update public.product_metrics_daily
set glance_views = 0, unique_viewers = 0, cart_adds = 0, updated_at = now()
where day >= date '2026-01-01';

select public.rollup_product_metrics(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as rows_rerolled;

select 'bot classifier live; metrics re-rolled on objective evidence' as status;
