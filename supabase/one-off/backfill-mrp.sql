-- ═══════════════════════════════════════════════════════════════
-- ONE-OFF: correct products.mrp from competitor NON-DISCOUNTED (list) prices.
-- NOT a migration, NOT recurring. Run by hand in the Supabase SQL editor.
--
-- Uses data already in the DB: competitor_prices.list_price is the source's
-- non-discounted/MRP price; × unit_factor converts it to OUR unit (e.g. a
-- per-metre wire price × 90 = per-coil). We copy that into products.mrp.
--
-- IMPORTANT — freshness: list_price reflects the LAST sync of each source. For
-- current numbers, first refresh it: GitHub → Actions → "Competitor price sync"
-- → Run workflow (does all enabled sources), OR /admin/radar → Sync now per
-- source. Then run STEP 1 to preview, and STEP 2 to apply.
--
-- Picking: when a product is mapped to several sources, prefer a
-- manufacturer-direct site (Crompton/Havells/Legrand/Syska) over a marketplace,
-- then the highest candidate. Guardrail: never set MRP below our elume_price.
-- ═══════════════════════════════════════════════════════════════

-- ── STEP 1 — PREVIEW (read-only). Review before applying. ──
with ranked as (
  select
    cp.product_id,
    round(cp.list_price * coalesce(cp.unit_factor, 1))::numeric(12,2) as new_mrp,
    case when cp.source in ('crompton','havells','legrand','syska') then 0 else 1 end as tier,
    cp.source
  from public.competitor_prices cp
  where cp.list_price is not null and cp.list_price > 0
),
best as (
  select distinct on (product_id) product_id, new_mrp, source
  from ranked
  order by product_id, tier asc, new_mrp desc
)
select
  p.brand, p.name,
  p.mrp            as current_mrp,
  b.new_mrp,
  b.source,
  p.elume_price,
  round((b.new_mrp - p.mrp) / nullif(p.mrp, 0) * 100) as pct_change,
  case
    when b.new_mrp < p.elume_price     then 'SKIP — below our price'
    when b.new_mrp = round(p.mrp,2)    then 'no change'
    else 'will update'
  end as status
from public.products p
join best b on b.product_id = p.id
order by status, pct_change desc nulls last;


-- ── STEP 2 — APPLY. Run once you're happy with the preview. ──
with ranked as (
  select
    cp.product_id,
    round(cp.list_price * coalesce(cp.unit_factor, 1))::numeric(12,2) as new_mrp,
    case when cp.source in ('crompton','havells','legrand','syska') then 0 else 1 end as tier,
    cp.source
  from public.competitor_prices cp
  where cp.list_price is not null and cp.list_price > 0
),
best as (
  select distinct on (product_id) product_id, new_mrp
  from ranked
  order by product_id, tier asc, new_mrp desc
)
update public.products p
set mrp = b.new_mrp
from best b
where p.id = b.product_id
  and b.new_mrp >= p.elume_price          -- guardrail: never below our selling price
  and b.new_mrp is distinct from p.mrp;   -- only actual changes
