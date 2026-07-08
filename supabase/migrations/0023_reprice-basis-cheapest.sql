-- ═══════════════════════════════════════════════════════════════
-- Switch the price radar to Amazon-style lowest-price matching: the global
-- repricing rule now undercuts the LOWEST mapped seller, not the average.
-- Only touches a saved GLOBAL rule set to market_avg; category overrides you
-- tuned by hand are left as-is. Idempotent; safe if repricing_settings is empty
-- (the code default is already 'cheapest').
-- ═══════════════════════════════════════════════════════════════

update public.repricing_settings
set basis = 'cheapest'
where scope = 'global' and basis = 'market_avg';

select scope, basis, delta, delta_type from public.repricing_settings order by scope;
