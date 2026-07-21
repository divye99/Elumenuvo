-- ═══════════════════════════════════════════════════════════════
-- 0054 · Purge crawler rows from site_events
--
-- Googlebot and friends execute JavaScript, so they ran the client tracker
-- and left "visitors" in analytics. The reliable identifier is the source
-- IP: Google's entire crawl/render fleet operates from 66.249.0.0/16
-- (no real shopper originates there), plus Bing's classic crawler ranges.
-- The /api/track ingest now drops these at the door; this removes what
-- already got in. Deleting by SESSION (sid), so every row of any session
-- that ever showed a crawler IP goes, including rows where the IP header
-- was missing. Legacy-seeded records (sid like 'legacy-%') are untouched.
-- ═══════════════════════════════════════════════════════════════

-- Eyeball first if you like:
-- select ip, count(*) from public.site_events
-- where ip like '66.249.%' or ip like '157.55.39.%' or ip like '207.46.13.%' or ip like '40.77.167.%'
-- group by ip order by 2 desc;

delete from public.site_events
where sid in (
  select distinct sid from public.site_events
  where ip like '66.249.%'
     or ip like '157.55.39.%'
     or ip like '207.46.13.%'
     or ip like '40.77.167.%'
)
and sid not like 'legacy-%';

-- Sanity: remaining visitor count
select count(distinct sid) as visitors_left from public.site_events;
