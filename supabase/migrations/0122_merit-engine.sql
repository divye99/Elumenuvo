-- 0122: Elume Merit Score (EMS) engine - manual overrides + exploration log.
--
-- merit_overrides: admin interventions on the ranking (owner requirement:
--   "see what's going on behind the scenes and do manual interventions").
--   boost is additive on the final EMS; suppressed sinks the product;
--   cooldown_until pauses exploration eligibility (ALWAYS temporary - set a
--   timestamp, never a flag).
-- explore_log: every time the exploration slot shows a product, one row -
--   the evidence trail for cooldowns and for the admin Merit panel.

create table if not exists public.merit_overrides (
  product_id     text primary key,
  boost          numeric not null default 0,     -- additive EMS adjustment (+/-)
  suppressed     boolean not null default false, -- hard sink in featured ordering
  cooldown_until timestamptz,                    -- exploration pause; null/past = eligible
  note           text,                           -- why (shown in the Merit panel)
  updated_at     timestamptz not null default now()
);
alter table public.merit_overrides enable row level security; -- service-role only

create table if not exists public.explore_log (
  id         bigint generated always as identity primary key,
  product_id text not null,
  brand      text,
  query_norm text,
  created_at timestamptz not null default now()
);
create index if not exists explore_log_product_idx on public.explore_log (product_id, created_at desc);
create index if not exists explore_log_created_idx on public.explore_log (created_at desc);
alter table public.explore_log enable row level security; -- service-role only
