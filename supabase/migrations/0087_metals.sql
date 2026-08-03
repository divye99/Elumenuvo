-- 0087: Metals catalogue - copper commerce + metals enquiries + market data.
--
-- The Metals family lives in the SAME public.products table as FMEG; the
-- discriminator is the category value (see METALS_CATEGORIES in src/lib/metals.ts).
-- FMEG admin surfaces (product manager, CSV export/import) exclude these
-- categories in code, so the two catalogues stay separate operationally.
--
-- Three new subsystems:
--   1. Copper products (Super D, CCR Rod, CC Rod) - seeded INACTIVE; the admin
--      sets the first ₹/kg rate in /admin/metals and activates them there.
--      elume_price stores the GST-INCLUSIVE PER-LOT price (site convention);
--      rods carry attrs.Lot ('3 MT'/'4 MT'), Super D sells per kg.
--   2. metal_enquiries - business-format enquiry for non-copper metals
--      (Aluminium, Zinc, Lead, Nickel, MS/TMT Steel, Stainless Steel).
--   3. metal_market_ticks / metal_market_daily / metal_feed_state - INTERNAL
--      LME + MCX copper reference series (admin console + analysis only;
--      public pages embed TradingView instead of displaying this data).

-- ── 1. Copper products ──────────────────────────────────────────────────────
-- Photos: curated royalty-free stock (Pexels licence, commercial-safe),
-- rehosted in our product-images bucket under metals/ - representative
-- imagery until the business supplies real product/warehouse photos.
insert into public.products (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order, is_active, attrs, hsn, parent_id, image_url, images)
values
  ('copper-super-d',     'CU-SUPERD',  'Copper Super D',                 'Elume', 'Copper', 'Premium high-conductivity copper',            995,     995,     'kg',  9010, false, null,                   '7403', null,
    'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-bright-wire.jpg',
    '["https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-bright-wire.jpg","https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-strands.jpg"]'::jsonb),
  ('copper-ccr-rod-3mt', 'CU-CCR-3MT', 'Copper CCR Rod',                 'Elume', 'Copper', 'Continuous cast copper rod · 3 MT lot',       2985000, 2985000, 'lot', 9020, false, '{"Lot":"3 MT"}'::jsonb, '7407', null,
    'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg',
    '["https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg","https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-bright-wire.jpg"]'::jsonb),
  ('copper-ccr-rod-4mt', 'CU-CCR-4MT', 'Copper CCR Rod',                 'Elume', 'Copper', 'Continuous cast copper rod · 4 MT lot',       3980000, 3980000, 'lot', 9021, false, '{"Lot":"4 MT"}'::jsonb, '7407', 'copper-ccr-rod-3mt',
    'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg',
    '["https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg","https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-bright-wire.jpg"]'::jsonb),
  ('copper-cc-rod-3mt',  'CU-CC-3MT',  'Copper CC Rod',                  'Elume', 'Copper', 'Continuous cast copper rod · 3 MT lot',       2985000, 2985000, 'lot', 9030, false, '{"Lot":"3 MT"}'::jsonb, '7407', null,
    'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-rod-dark.jpg',
    '["https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-rod-dark.jpg","https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg"]'::jsonb),
  ('copper-cc-rod-4mt',  'CU-CC-4MT',  'Copper CC Rod',                  'Elume', 'Copper', 'Continuous cast copper rod · 4 MT lot',       3980000, 3980000, 'lot', 9031, false, '{"Lot":"4 MT"}'::jsonb, '7407', 'copper-cc-rod-3mt',
    'https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-rod-dark.jpg',
    '["https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-rod-dark.jpg","https://jfgsigpadpewfktsohmc.supabase.co/storage/v1/object/public/product-images/metals/copper-spirals.jpg"]'::jsonb)
on conflict (id) do nothing;

-- ── 2. Metals enquiries (business-format, GSTIN-verified leads) ─────────────
create table if not exists public.metal_enquiries (
  id         uuid primary key default gen_random_uuid(),
  company    text not null check (char_length(company) between 2 and 160),
  gstin      text not null check (gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  name       text not null check (char_length(name) between 2 and 120),
  email      text not null check (char_length(email) between 5 and 200),
  phone      text not null check (char_length(phone) between 8 and 20),
  metal      text not null check (char_length(metal) between 2 and 60),
  message    text not null check (char_length(message) between 10 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists metal_enquiries_created_idx on public.metal_enquiries (created_at desc);

alter table public.metal_enquiries enable row level security;
drop policy if exists "public submit metal enquiry" on public.metal_enquiries;
create policy "public submit metal enquiry" on public.metal_enquiries
  for insert to anon, authenticated with check (true);
-- no select policy: reads are admin-only via the service role.

-- ── 3. Internal market reference series (LME + MCX copper) ──────────────────
-- Intraday snapshots, one row per ingest run. series values today:
--   'mcx_copper'     - MCX near-month copper future, INR/kg  (Angel One feed)
--   'lme_copper_3m'  - LME copper 3-month, USD/tonne         (metals.dev feed)
create table if not exists public.metal_market_ticks (
  series     text not null,
  ts         timestamptz not null default now(),
  price      numeric(14,4) not null,
  currency   text not null,
  unit       text not null,             -- 'kg' | 'mt'
  change     numeric(14,4),             -- vs previous market-day close
  change_pct numeric(9,4),
  meta       jsonb,                     -- e.g. {"symbol":"COPPER...FUT","expiry":"..."}
  primary key (series, ts)
);
create index if not exists metal_market_ticks_series_ts_idx on public.metal_market_ticks (series, ts desc);

-- One close per series per market day (IST day for MCX, UTC day for LME).
-- Backfills (Westmetall 5y LME, Kite 5y MCX) load straight into this table.
create table if not exists public.metal_market_daily (
  series   text not null,
  day      date not null,
  open     numeric(14,4),
  high     numeric(14,4),
  low      numeric(14,4),
  close    numeric(14,4) not null,
  currency text not null,
  unit     text not null,
  meta     jsonb,
  primary key (series, day)
);

-- Tiny key/value state for the feed workers (e.g. the resolved near-month
-- MCX contract token, so every run doesn't re-search the instrument master).
create table if not exists public.metal_feed_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Internal-only data: RLS on, NO policies - service role only.
alter table public.metal_market_ticks enable row level security;
alter table public.metal_market_daily enable row level security;
alter table public.metal_feed_state  enable row level security;
