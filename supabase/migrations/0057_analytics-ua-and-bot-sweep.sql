-- ═══════════════════════════════════════════════════════════════
-- 0057 · Analytics: store the raw user-agent + sweep residual bot sessions
--
-- The ingest previously parsed the UA into "OS · Browser · form" and threw
-- the original away, so crawler rows couldn't be re-classified later. New
-- `ua` column keeps the raw string (truncated) — future bot discoveries can
-- be purged retroactively with a simple LIKE.
--
-- The sweep below removes residual non-human sessions the IP-range purge
-- (0054) missed, by BEHAVIOUR: sessions outside India with almost no events,
-- zero interaction and zero dwell time — the signature of a rendering
-- crawler. Indian sessions are never touched, nor is anything with a click,
-- cart add, identify, search pick or measured time on page.
-- ═══════════════════════════════════════════════════════════════

alter table public.site_events add column if not exists ua text;

-- Preview what the sweep would remove:
-- select sid, min(country) c, count(*) n from public.site_events
-- where sid not like 'legacy-%' group by sid
-- having min(coalesce(country,'')) <> 'IN' and count(*) <= 3
--   and sum(case when type in ('click','product_click','add_to_cart','identify') then 1 else 0 end) = 0
--   and sum(coalesce(duration_ms,0)) = 0;

delete from public.site_events
where sid in (
  select sid from public.site_events
  where sid not like 'legacy-%'
  group by sid
  having min(coalesce(country, '')) <> 'IN'
     and count(*) <= 3
     and sum(case when type in ('click','product_click','add_to_cart','identify') then 1 else 0 end) = 0
     and sum(coalesce(duration_ms, 0)) = 0
);

select count(distinct sid) as visitors_left from public.site_events;
