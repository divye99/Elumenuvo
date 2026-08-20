-- ═══════════════════════════════════════════════════════════════
-- 0128 · Bot classifier v2: the fleet-IP signal
--
-- Owner (Aug 2026): "bot filtering needs to get strengthened, don't think
-- we're capturing it all" AND "engagement is not equal to views - people
-- just viewing must never be filtered out." Both honored: viewing alone
-- NEVER flags anyone; engagement is only ever exculpatory evidence.
--
-- The remaining leak: crawlers on CURRENT browser versions minting a fresh
-- device token per hit. Their tell: one exit IP, MANY distinct session ids,
-- and not one tap anywhere - our tracker records every real tap as a click
-- event, and across 6+ sessions from one place, real humans always tap
-- something. Fleet-ip therefore fires only when an IP has 6+ distinct sids
-- AND zero clicks AND zero carts AND zero sign-ins across ALL of them. A
-- lone quiet reader (1 sid from their IP) can never trip it; a small office
-- clears itself the moment anyone taps anything at all.
-- Keep in lockstep with FLEET_IP_MIN_SIDS in src/lib/bots.ts.
--
-- Then re-classifies all history and re-rolls product metrics so EMS sheds
-- anything the new signal catches retroactively.
-- ═══════════════════════════════════════════════════════════════

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
      max(ip) as ip,
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

  with fleet_ua as (
    select ua from _sess
    where ua is not null
    group by ua
    having count(*) >= 8 and bool_and(not engaged)
  ),
  fleet_ip as (
    -- One exit IP, 6+ fresh device tokens, and not a single tap, cart or
    -- sign-in across ANY of them: an automation fleet. Any click anywhere
    -- on the IP clears it entirely (dwell is deliberately NOT enough to
    -- clear - the proxy wave fakes leave-timers - but it is never used
    -- against anyone either).
    select ip from _sess
    where ip is not null
    group by ip
    having count(*) >= 6
       and coalesce(sum(clicks), 0) = 0
       and coalesce(sum(carts), 0) = 0
       and not bool_or(identified)
  )
  insert into bot_sessions (sid, reason)
  select
    s.sid,
    case
      when s.crawl_ip then 'crawl-ip'
      when s.ua_bot then 'bot-ua'
      when s.stale then 'stale-browser'
      when s.ua in (select ua from fleet_ua) then 'fleet-ua'
      when s.ip in (select ip from fleet_ip) then 'fleet-ip'
      else 'heavy-crawl'
    end
  from _sess s
  where not s.engaged
    and (
      s.crawl_ip
      or s.ua_bot
      or s.stale
      or s.ua in (select ua from fleet_ua)
      or s.ip in (select ip from fleet_ip)
      or (s.pv >= 10 and s.clicks = 0 and s.ms = 0 and s.carts = 0)
    )
  on conflict (sid) do nothing;

  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.classify_bot_sessions(date, date) from public, anon, authenticated;

-- ── Re-sweep history with the new signal, then re-roll product metrics ──
select public.classify_bot_sessions(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as newly_flagged;

update public.product_metrics_daily
set glance_views = 0, unique_viewers = 0, cart_adds = 0, updated_at = now()
where day >= date '2026-01-01';

select public.rollup_product_metrics(date '2026-01-01', (now() at time zone 'Asia/Kolkata')::date) as rows_rerolled;

select 'fleet-ip signal live; history re-swept' as status;
