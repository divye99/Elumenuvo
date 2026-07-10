-- ═══════════════════════════════════════════════════════════════
-- Migration status probe — paste into Supabase → SQL Editor and Run.
-- For each schema-changing migration it reports whether the object it
-- creates already exists (applied = true) or not (applied = false).
-- Data-only seed migrations aren't listed — they're safe to re-run
-- (all use `on conflict do nothing`); see the note at the bottom.
-- ═══════════════════════════════════════════════════════════════

with checks(migration, object, applied) as (
  values
    ('0001 catalogue',            'table products',                     (to_regclass('public.products')            is not null)),
    ('0002 catalogue-v2',         'table reviews',                      (to_regclass('public.reviews')             is not null)),
    ('0002 catalogue-v2',         'table waitlist',                     (to_regclass('public.waitlist')            is not null)),
    ('0002 catalogue-v2',         'products.attrs column',              exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='attrs')),
    ('0006 content',              'table content',                      (to_regclass('public.content')             is not null)),
    ('0007 profiles',             'table profiles',                     (to_regclass('public.profiles')            is not null)),
    ('0009 checkout',             'table orders',                       (to_regclass('public.orders')              is not null)),
    ('0011 import-log',           'table import_log',                   (to_regclass('public.import_log')          is not null)),
    ('0012 competitor-pricing',   'table competitor_sources',           (to_regclass('public.competitor_sources')  is not null)),
    ('0012 competitor-pricing',   'table competitor_map',               (to_regclass('public.competitor_map')      is not null)),
    ('0012 competitor-pricing',   'table competitor_prices',            (to_regclass('public.competitor_prices')   is not null)),
    ('0015 repricing',            'table repricing_settings',           (to_regclass('public.repricing_settings')  is not null)),
    ('0016 price-history',        'table price_history',                (to_regclass('public.price_history')       is not null)),
    ('0017 online-payment',       'orders.razorpay_order_id column',    exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='razorpay_order_id')),
    ('0025 partner-leads',        'table partner_leads',                (to_regclass('public.partner_leads')       is not null)),
    ('0026 brand-sku-condition',  'products.brand_sku column',          exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='brand_sku')),
    ('0026 brand-sku-condition',  'competitor_map.item_condition col',  exists (select 1 from information_schema.columns where table_schema='public' and table_name='competitor_map' and column_name='item_condition')),
    ('0026 brand-sku-condition',  'competitor_prices.item_condition',   exists (select 1 from information_schema.columns where table_schema='public' and table_name='competitor_prices' and column_name='item_condition'))
)
select migration, object,
       case when applied then '✅ applied' else '❌ MISSING — run it' end as status
from checks
order by migration, object;

-- Data-only seed migrations (safe to re-run any time — idempotent):
--   0003, 0005, 0013, 0014, 0018, 0019, 0021, 0022, 0023, 0024.
-- If unsure whether these ran, just re-run them; `on conflict do nothing`
-- and `if not exists` make them harmless.
--
-- ⚠️  Do NOT blindly re-run 0012 — it starts with `drop table ... cascade`
--     and would WIPE competitor_map / competitor_prices / sync_log. Only run
--     0012 if the probe above shows those three tables MISSING.
