-- ═══════════════════════════════════════════════════════════════
-- User profiles — account type (business / individual), GSTIN, company.
-- Run once in Supabase → SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  account_type text,                          -- 'business' | 'individual' | null (not chosen yet)
  full_name    text,
  company      text,
  gstin        text,
  phone        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users read + write only their own profile.
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile upsert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- Create an empty profile row automatically on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
