-- ═══════════════════════════════════════════════════════════════
-- Competitor price radar v2 — MULTI-SOURCE (Vashi now; Amazon / Moglix / … next)
-- Run once in Supabase → SQL Editor. Replaces the earlier competitor-pricing.sql
-- (those tables held no data yet). Idempotent.
--
-- What's new vs v1:
--   • `source` on every row  → track the same product across many sites.
--   • list_price + net_price  → the public MRP/list price AND the logged-in
--                               B2B selling price (Vashi shows ₹92.75 public,
--                               ₹43.78 to an account) — comparable_price uses
--                               net when we have it, else list × unit_factor.
--   • competitor_price_history → one row per sync, per product, per source →
--                               feeds the per-product price-comparison chart.
-- Internal: service-role (admin + GitHub Action) only, never public.
-- ═══════════════════════════════════════════════════════════════

drop table if exists public.competitor_prices cascade;
drop table if exists public.competitor_map cascade;
drop table if exists public.competitor_sync_log cascade;

-- Registry of tracked sites (admin can see what's available; adapters are code).
create table if not exists public.competitor_sources (
  id         text primary key,          -- 'vashi', 'amazon', 'moglix'
  name       text not null,
  site_url   text,
  enabled    boolean not null default true,
  needs_login boolean not null default false,
  sort_order int not null default 0
);
insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('vashi',  'Vashi',  'https://vashiisl.com',  true,  true,  1),
  ('amazon', 'Amazon', 'https://www.amazon.in', false, false, 2),
  ('moglix', 'Moglix', 'https://www.moglix.com', false, false, 3)
on conflict (id) do nothing;

-- Our product ↔ one competitor item, per source.
create table if not exists public.competitor_map (
  product_id      text not null references public.products(id) on delete cascade,
  source          text not null references public.competitor_sources(id) on delete cascade,
  competitor_code text not null,
  competitor_url  text,
  unit_factor     numeric not null default 1,   -- competitor price × this = comparable to our unit
  note            text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (product_id, source)
);

-- Latest snapshot per (product, source).
create table if not exists public.competitor_prices (
  product_id       text not null references public.products(id) on delete cascade,
  source           text not null references public.competitor_sources(id) on delete cascade,
  competitor_code  text,
  competitor_name  text,
  competitor_url   text,
  list_price       numeric,     -- public / MRP price (in competitor's own unit)
  net_price        numeric,     -- logged-in B2B selling price (null until authenticated)
  unit_factor      numeric,
  comparable_price numeric,     -- (net_price ?? list_price) × unit_factor
  suggested_price  numeric,     -- comparable_price − 1
  our_price        numeric,
  status           text not null default 'pending', -- pending | accepted | dismissed
  in_stock         boolean,
  currency         text default 'INR',
  fetched_at       timestamptz not null default now(),
  primary key (product_id, source)
);
create index if not exists competitor_prices_status_idx on public.competitor_prices (status);

-- Full history → per-product price-comparison chart.
create table if not exists public.competitor_price_history (
  id               uuid primary key default gen_random_uuid(),
  product_id       text not null references public.products(id) on delete cascade,
  source           text not null,
  list_price       numeric,
  net_price        numeric,
  comparable_price numeric,
  our_price        numeric,
  captured_at      timestamptz not null default now()
);
create index if not exists competitor_hist_idx on public.competitor_price_history (product_id, captured_at);

create table if not exists public.competitor_sync_log (
  id          uuid primary key default gen_random_uuid(),
  source      text not null default 'vashi',
  mapped      int not null default 0,
  fetched     int not null default 0,
  failed      int not null default 0,
  suggestions int not null default 0,
  run_source  text not null default 'cron',   -- cron | manual
  created_at  timestamptz not null default now()
);

alter table public.competitor_sources enable row level security;
alter table public.competitor_map enable row level security;
alter table public.competitor_prices enable row level security;
alter table public.competitor_price_history enable row level security;
alter table public.competitor_sync_log enable row level security;
-- Chart reads the history via the anon key on the public product page, so give
-- it read-only access to history (prices only, no internal codes/notes):
drop policy if exists "public read price history" on public.competitor_price_history;
create policy "public read price history" on public.competitor_price_history for select using (true);
