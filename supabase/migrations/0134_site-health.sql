-- 0134: uptime monitor storage (owner, 21 Aug 2026).
-- /api/cron/health runs every five minutes: it times the database, auth,
-- the home page, the catalogue page and one live product page, stores one
-- row here, and emails the owner when something is down or slow (with a
-- 15-minute cooldown) and again when it recovers. /admin/health reads the
-- last days of rows. Service role only; no public policies. Idempotent.

create table if not exists public.site_health_checks (
  id               bigserial primary key,
  at               timestamptz not null default now(),
  status           text not null check (status in ('ok', 'slow', 'down')),
  db_ok            boolean not null,
  db_ms            integer,
  auth_ok          boolean not null,
  auth_ms          integer,
  home_status      integer,
  home_ms          integer,
  catalogue_status integer,
  catalogue_ms     integer,
  pdp_status       integer,
  pdp_ms           integer,
  pdp_path         text,
  note             text
);
create index if not exists site_health_checks_at_idx on public.site_health_checks (at desc);
alter table public.site_health_checks enable row level security;

create table if not exists public.site_health_state (
  singleton     boolean primary key default true check (singleton),
  last_ok_at    timestamptz,
  last_alert_at timestamptz,
  failing_since timestamptz
);
insert into public.site_health_state (singleton) values (true) on conflict (singleton) do nothing;
alter table public.site_health_state enable row level security;
