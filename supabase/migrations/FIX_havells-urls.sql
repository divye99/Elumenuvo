-- ═══════════════════════════════════════════════════════════════
-- FIX · Havells product links 404 (missing .html suffix)
--
-- Havells (Magento) serves product pages at /<url_key>.html; the stored links
-- used the bare url_key, which 404s. Append .html to existing Havells rows.
-- Atomberg is the opposite (bare url_key is correct there), so ONLY havells is
-- touched. The sync now writes canonical URLs, so new rows are already right.
-- Idempotent: the "not like" guard skips rows already fixed.
-- ═══════════════════════════════════════════════════════════════

update public.competitor_map
set competitor_url = competitor_url || '.html'
where source = 'havells'
  and competitor_url is not null
  and competitor_url like 'https://havells.com/%'
  and competitor_url not like '%.html';

update public.competitor_prices
set competitor_url = competitor_url || '.html'
where source = 'havells'
  and competitor_url is not null
  and competitor_url like 'https://havells.com/%'
  and competitor_url not like '%.html';

-- Review: every stored Havells link should now end in .html
select 'map' as tbl, competitor_url from public.competitor_map where source = 'havells' and competitor_url is not null
union all
select 'price', competitor_url from public.competitor_prices where source = 'havells' and competitor_url is not null
order by 1, 2;
