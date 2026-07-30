-- 0076: Projects as procurement sites + automatic saved addresses.
--
-- 1. app_projects grows full checkout-grade delivery details (site contact
--    person, phone, structured address), so picking a project at checkout
--    can populate every field.
-- 2. saved_addresses: every PAID order's delivery address + phone is saved
--    automatically (keyed by email, deduped by fingerprint), so repeat
--    buyers pick a saved address instead of retyping.
-- 3. orders.address_details carries the STRUCTURED address from checkout to
--    payment confirmation (the legacy billing/shipping columns are composed
--    single-line strings and cannot repopulate a form).

-- ── 1. Projects: site contact + structured address ──
alter table public.app_projects add column if not exists contact_name  text;
alter table public.app_projects add column if not exists contact_phone text;          -- E.164
alter table public.app_projects add column if not exists address_line1 text;
alter table public.app_projects add column if not exists address_line2 text;
alter table public.app_projects add column if not exists address_line3 text;
alter table public.app_projects add column if not exists city          text;
alter table public.app_projects add column if not exists district      text;
alter table public.app_projects add column if not exists state         text;
alter table public.app_projects add column if not exists pin           text;

-- ── 2. Saved addresses (auto-captured from paid orders) ──
create table if not exists public.saved_addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade,
  email         text not null,                  -- lowercased; guest orders attach when they sign up
  contact_name  text,
  phone         text,                           -- E.164
  address_line1 text not null,
  address_line2 text,
  address_line3 text,
  city          text,
  district      text,
  state         text,
  pin           text,
  country       text not null default 'India',
  fingerprint   text not null,                  -- normalized address+phone, dedupes repeats
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),
  unique (email, fingerprint)
);

create index if not exists saved_addresses_email_idx on public.saved_addresses (email, last_used_at desc);

alter table public.saved_addresses enable row level security;

-- Reads are owner-scoped for signed-in users (their own email or user id).
-- Writes happen ONLY server-side with the service role at payment time, so
-- there are deliberately no insert/update policies for authenticated users.
drop policy if exists "own addresses select" on public.saved_addresses;
create policy "own addresses select" on public.saved_addresses
  for select to authenticated
  using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email);

drop policy if exists "own addresses delete" on public.saved_addresses;
create policy "own addresses delete" on public.saved_addresses
  for delete to authenticated
  using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email);

-- ── 3. Structured address on the order row ──
alter table public.orders add column if not exists address_details jsonb;
