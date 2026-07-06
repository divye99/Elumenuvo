-- ═══════════════════════════════════════════════════════════════
-- Competitor price radar — monthly Vashi (vashiisl.com) price tracking.
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- Model (curated, human-in-the-loop):
--   competitor_map    — admin maps each Elume product to ONE Vashi product
--                       code + a unit_factor (multiply Vashi's price to make it
--                       comparable to our unit, e.g. ×90 for per-metre → 90 m coil).
--   competitor_prices — the monthly job refetches each mapped code's live price,
--                       computes the comparable price + suggested (comparable − ₹1),
--                       and leaves a suggestion for the admin to Accept / Dismiss.
--
-- Both are internal: service-role (admin + GitHub Action) only, never public.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.competitor_map (
  product_id  text primary key references public.products(id) on delete cascade,
  vashi_code  text not null,
  unit_factor numeric not null default 1,   -- Vashi price × this = comparable to our unit
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.competitor_prices (
  product_id      text primary key references public.products(id) on delete cascade,
  vashi_code      text,
  vashi_name      text,
  vashi_url       text,
  vashi_price     numeric,      -- raw, in Vashi's own unit
  unit_factor     numeric,      -- copied from the map at fetch time
  comparable_price numeric,     -- vashi_price × unit_factor (apples-to-apples vs our Elume price)
  suggested_price numeric,      -- comparable_price − 1 (₹1 under Vashi)
  our_price       numeric,      -- our Elume price at fetch time (for the diff)
  status          text not null default 'pending', -- pending | accepted | dismissed
  in_stock        boolean,
  fetched_at      timestamptz not null default now()
);
create index if not exists competitor_prices_status_idx on public.competitor_prices (status);

alter table public.competitor_map enable row level security;
alter table public.competitor_prices enable row level security;
-- No anon/authenticated policies: only the service-role admin + cron path touches these.

-- Log of automated syncs (so the dashboard can show "last run").
create table if not exists public.competitor_sync_log (
  id          uuid primary key default gen_random_uuid(),
  mapped      int not null default 0,
  fetched     int not null default 0,
  failed      int not null default 0,
  suggestions int not null default 0,
  source      text not null default 'cron',   -- cron | manual
  created_at  timestamptz not null default now()
);
alter table public.competitor_sync_log enable row level security;
