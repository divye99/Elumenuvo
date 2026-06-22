-- ============================================================
-- Elumenuvo waitlist — Supabase setup
-- Run this ONCE in Supabase → SQL Editor → New query → Run.
-- ============================================================

create table if not exists public.waitlist (
  id          bigint generated always as identity primary key,
  email       text not null,
  company     text not null,
  need        text,
  created_at  timestamptz not null default now()
);

-- One row per email (a repeat signup is treated as success by the page).
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

-- Lock the table down, then allow ONLY anonymous inserts (no reads).
alter table public.waitlist enable row level security;

drop policy if exists "anon can join waitlist" on public.waitlist;
create policy "anon can join waitlist"
  on public.waitlist
  for insert
  to anon
  with check (true);

-- NOTE: there is intentionally NO select policy, so the public anon key
-- cannot read the list. View signups from the Supabase Table Editor /
-- dashboard (which uses the service role), not from the website.
