-- ═══════════════════════════════════════════════════════════════
-- 0053 · Real workspace projects (the /app dashboard goes live)
--
-- The buyer workspace was a hardcoded demo (Meridian Developments, ₹2.42 Cr,
-- Aurelia Towers). Live accounts now see THEIR data: KPIs derived from their
-- real orders, and projects they create themselves, stored here.
--
-- RLS: strictly owner-scoped. A signed-in user can only ever see and manage
-- their own projects.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.app_projects (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 120),
  site       text check (char_length(site) <= 160),
  stage      text not null default 'Rough-in' check (stage in ('Rough-in', 'Wiring', 'Panel & DB', 'Finishing')),
  created_at timestamptz not null default now()
);

create index if not exists app_projects_user_idx on public.app_projects (user_id, created_at desc);

alter table public.app_projects enable row level security;

drop policy if exists "own projects select" on public.app_projects;
create policy "own projects select" on public.app_projects for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own projects insert" on public.app_projects;
create policy "own projects insert" on public.app_projects for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own projects update" on public.app_projects;
create policy "own projects update" on public.app_projects for update to authenticated using (auth.uid() = user_id);
drop policy if exists "own projects delete" on public.app_projects;
create policy "own projects delete" on public.app_projects for delete to authenticated using (auth.uid() = user_id);
