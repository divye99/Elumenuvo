-- ============================================================
-- Elumenuvo portal v1 — Supabase schema + RLS
-- Run ONCE in Supabase → SQL Editor after supabase-setup.sql.
--
-- Roles: every new user is a 'client' by default. To make someone a
-- 'supplier' or 'admin', update their row in public.profiles manually.
-- Request status is advanced by an 'admin' (you) — clients/suppliers
-- cannot change it.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  company     text,
  role        text not null default 'client'
              check (role in ('client', 'supplier', 'admin')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Auto-create a profile row when a user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- procurement_requests ----------
create table if not exists public.procurement_requests (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  company      text,
  item         text not null,
  quantity     text,
  target_date  date,
  notes        text,
  status       text not null default 'received'
               check (status in ('received', 'sourcing', 'quoted', 'ordered', 'shipped')),
  created_at   timestamptz not null default now()
);

alter table public.procurement_requests enable row level security;

drop policy if exists "client insert own request" on public.procurement_requests;
create policy "client insert own request" on public.procurement_requests
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "client read own request" on public.procurement_requests;
create policy "client read own request" on public.procurement_requests
  for select to authenticated using (user_id = auth.uid());

-- Suppliers and admins can read all requests (to respond / manage).
drop policy if exists "supplier read all requests" on public.procurement_requests;
create policy "supplier read all requests" on public.procurement_requests
  for select to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role in ('supplier', 'admin'))
  );

-- Only admins change status (manual workflow for v1).
drop policy if exists "admin update request" on public.procurement_requests;
create policy "admin update request" on public.procurement_requests
  for update to authenticated using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------- quotes (supplier responses) ----------
create table if not exists public.quotes (
  id          bigint generated always as identity primary key,
  request_id  bigint not null references public.procurement_requests (id) on delete cascade,
  supplier_id uuid not null references auth.users (id) on delete cascade,
  price       text,
  lead_time   text,
  notes       text,
  created_at  timestamptz not null default now()
);

alter table public.quotes enable row level security;

drop policy if exists "supplier insert quote" on public.quotes;
create policy "supplier insert quote" on public.quotes
  for insert to authenticated with check (
    supplier_id = auth.uid()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role in ('supplier', 'admin'))
  );

drop policy if exists "supplier read own quote" on public.quotes;
create policy "supplier read own quote" on public.quotes
  for select to authenticated using (supplier_id = auth.uid());

-- Clients can read quotes attached to their own requests.
drop policy if exists "client read quotes on own request" on public.quotes;
create policy "client read quotes on own request" on public.quotes
  for select to authenticated using (
    exists (select 1 from public.procurement_requests r
            where r.id = request_id and r.user_id = auth.uid())
  );
