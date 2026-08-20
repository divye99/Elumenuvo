-- ═══════════════════════════════════════════════════════════════
-- 0127 · analytics_daily(): in-database daily traffic aggregation
--
-- Why: the admin analytics page used to fetch raw site_events (capped at
-- 20,000 rows, OLDEST first) and aggregate in JS. Once a window crossed the
-- cap, the NEWEST days silently vanished - "Thursday shows 2 visitors" -
-- and every page load shipped megabytes of events. As traffic grows, the
-- database is the right place to collate.
--
-- analytics_daily returns one row per IST day: unique human visitors,
-- pageviews, cart sessions and identified sessions. Humans only: sessions
-- classified into bot_sessions (0124) are excluded here, in the database,
-- before anything crosses the wire. Works for any window (the 90-day view
-- costs the same as the 7-day one).
--
-- The nightly cron keeps bot_sessions fresh; the traffic page additionally
-- classifies today's window on load so the current day is bot-clean too.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.analytics_daily(from_day date, to_day date)
returns table (
  day        date,
  visitors   int,
  pageviews  int,
  carts      int,
  identified int
)
language sql
security definer
set search_path = public
as $$
  with human as (
    select
      (e.created_at at time zone 'Asia/Kolkata')::date as d,
      e.sid,
      e.type
    from site_events e
    where (e.created_at at time zone 'Asia/Kolkata')::date between from_day and to_day
      and not exists (select 1 from bot_sessions b where b.sid = e.sid)
  ),
  idents as (select distinct sid from human where type = 'identify')
  select
    h.d as day,
    count(distinct h.sid) filter (where h.type = 'pageview')::int as visitors,
    count(*) filter (where h.type = 'pageview')::int as pageviews,
    count(distinct h.sid) filter (where h.type = 'add_to_cart')::int as carts,
    count(distinct h.sid) filter (where h.type = 'pageview' and h.sid in (select sid from idents))::int as identified
  from human h
  group by h.d
  order by h.d;
$$;

revoke execute on function public.analytics_daily(date, date) from public, anon, authenticated;

-- Speed: the function scans by day; give it an expression index.
create index if not exists site_events_ist_day_idx
  on public.site_events (((created_at at time zone 'Asia/Kolkata')::date));
create index if not exists site_events_sid_idx on public.site_events (sid);

select 'in-database daily analytics ready' as status;
