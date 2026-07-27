-- ═══════════════════════════════════════════════════════════════
-- 0062: Per-product GST rate + a real HSN column.
--
-- Until now the GST rate was derived from the CATEGORY alone, which cannot
-- express a product that sits in a category at one rate but is taxed at
-- another. Solar lanterns are exactly that: they live in Lighting (12%) but
-- are renewable-energy devices, moved to the 5% slab in the September 2025
-- GST rationalisation.
--
-- products.gst_rate  → decimal rate (0.05 = 5%). NULL means "use the category
--                      default" (src/lib/pricing.ts GST_RATES), so nothing
--                      changes for the other 3,300 products.
-- products.hsn       → HSN code for GST invoicing. Backfilled from attrs.HSN
--                      where we already had it (house wires, 8544); NULL
--                      everywhere else until sourced per range.
--
-- NOTE: prices are stored GST-INCLUSIVE, so no customer price changes here.
-- Only the ex-GST/GST split shown on the storefront and on invoices moves.
-- ═══════════════════════════════════════════════════════════════

alter table public.products add column if not exists gst_rate numeric(5,4);
alter table public.products add column if not exists hsn      text;

comment on column public.products.gst_rate is 'GST rate as a decimal (0.05 = 5%). NULL = use the category default.';
comment on column public.products.hsn      is 'HSN code for GST invoicing. Determines the lawful rate; confirm per range with the CA.';

-- ── 1. Backfill HSN we already hold: all house wires are HSN 8544 ──
update public.products
set hsn = attrs->>'HSN'
where hsn is null and attrs ? 'HSN';

-- ── 2. Solar lighting → 5% (renewable energy devices) ──
-- Scoped to Lighting on purpose: the Elume "Solar Flare" house wires are a
-- COLOUR named Solar Flare, not solar products, and stay at 18%.
update public.products
set gst_rate = 0.0500
where category = 'Lighting'
  and name ilike '%solar%';

-- ── 3. Report what changed, so the SQL Editor shows the affected rows ──
select id, name, category, elume_price, gst_rate, hsn
from public.products
where gst_rate is not null
order by name;

select
  count(*) filter (where hsn is not null)      as products_with_hsn,
  count(*) filter (where gst_rate is not null) as products_with_gst_override,
  count(*)                                     as total_active
from public.products
where is_active;
