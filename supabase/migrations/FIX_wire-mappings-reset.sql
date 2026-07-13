-- ═══════════════════════════════════════════════════════════════
-- FIX · Reset AUTO-created wire mappings (bad core-count matches)
--
-- The old name matcher rewarded shared tokens (4 sqmm) but never penalised
-- conflicting ones (1 core vs 6 core), so house wires got mapped to multi-core
-- flexible cables on Vashi. The matcher is now conflict-aware; this wipes the
-- suspect AUTO wire mappings (+ their price snapshots) so the fixed
-- "Auto-map competitors" workflow can re-create only correct ones.
--
-- MANUAL wire mappings (no 'auto:' note) are untouched.
-- ═══════════════════════════════════════════════════════════════

-- Price snapshots of auto-mapped wire products first (FK-independent tables).
-- Note prefixes: 0013 seeds wrote 'auto · score …', 0022/v2 wrote 'auto: …'.
delete from public.competitor_prices cp
using public.competitor_map m, public.products p
where cp.product_id = m.product_id and cp.source = m.source
  and m.product_id = p.id
  and p.category = 'Wires & Cables'
  and m.note like 'auto%';

-- Then the mappings themselves.
delete from public.competitor_map m
using public.products p
where m.product_id = p.id
  and p.category = 'Wires & Cables'
  and m.note like 'auto%';

-- What's left mapped in wires (should be only manual/seed mappings):
select m.source, count(*) as mappings
from public.competitor_map m join public.products p on p.id = m.product_id
where p.category = 'Wires & Cables'
group by m.source order by m.source;
