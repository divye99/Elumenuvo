-- ═══════════════════════════════════════════════════════════════
-- Repricing rules — strategy + guardrails for competitor-driven pricing.
-- Run once in Supabase → SQL Editor. Idempotent. Internal (service-role only).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.repricing_settings (
  scope           text primary key,                        -- 'global' or a category name
  basis           text not null default 'market_avg',      -- market_avg | cheapest
  delta           numeric not null default 1,              -- go this much under the basis
  delta_type      text not null default 'rupees',          -- rupees | percent
  max_change_pct  numeric not null default 40,             -- block swings bigger than this
  never_above_mrp boolean not null default true,
  enabled         boolean not null default true,
  updated_at      timestamptz not null default now()
);

-- Default: price ₹1 under the market average, never above MRP, never a >40% swing.
insert into public.repricing_settings (scope) values ('global')
on conflict (scope) do nothing;

alter table public.repricing_settings enable row level security;
-- No anon policies — admin (service role) only.
