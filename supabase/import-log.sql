-- ═══════════════════════════════════════════════════════════════
-- Bulk-import change log for the admin Excel/CSV importer.
-- Run once in Supabase → SQL Editor. Idempotent.
-- Written server-side (service role) only; not publicly readable.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.import_log (
  id         uuid primary key default gen_random_uuid(),
  actor      text,
  filename   text,
  added      int  not null default 0,
  updated    int  not null default 0,
  removed    int  not null default 0,
  summary    text[],                       -- one line per change applied
  created_at timestamptz not null default now()
);
create index if not exists import_log_created_idx on public.import_log (created_at desc);

alter table public.import_log enable row level security;
-- No anon/authenticated policies: only the service-role admin path reads/writes.
