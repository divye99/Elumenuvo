-- 0089: GSTINs and phone numbers become saved, multi-value fields.
--
-- Why: a group can hold several GST registrations (one per state, or one per
-- entity), and a single gstin column on the profile forces the buyer to retype
-- and silently invites the wrong one onto an invoice. The same is true of
-- phones: one traced session produced three different numbers in ninety
-- seconds (sign-up, onboarding, delivery contact) with no way to tell which
-- was which afterwards.
--
-- Shape mirrors saved_addresses deliberately, so all three behave the same at
-- checkout and in account settings: pick a saved one, or add a new one, and
-- whatever is added shows up in both places from then on.
--
-- Projects gain a GSTIN so a site can bill to its own registration; combined
-- with the address columns from 0076 a project is now a complete "bill and
-- ship like this" preset.

-- ── Saved GSTINs ──
create table if not exists public.saved_gstins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  email        text not null,                       -- lowercased; guest orders attach on sign-up
  gstin        text not null check (char_length(gstin) = 15),
  label        text,                                -- "Head office", "MP site", or the legal name
  state        text,                                -- derived from the GSTIN's first two digits
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (email, gstin)
);
create index if not exists saved_gstins_email_idx on public.saved_gstins (email, last_used_at desc);

-- ── Saved phone numbers ──
-- `source` records WHERE the number came from, so account settings can say
-- "delivery contact" rather than showing three anonymous numbers.
create table if not exists public.saved_phones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users (id) on delete cascade,
  email        text not null,
  phone        text not null,                       -- E.164
  label        text,                                -- what the customer calls it
  source       text not null default 'checkout'
    check (source in ('account', 'onboarding', 'checkout', 'delivery', 'billing', 'manual')),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (email, phone)
);
create index if not exists saved_phones_email_idx on public.saved_phones (email, last_used_at desc);

-- ── A project can bill to its own registration ──
alter table public.app_projects add column if not exists gstin text;

-- ── RLS: owner-scoped, and writable by the owner ──
-- saved_addresses (0076) is service-role-write only because it captured itself
-- from orders. These two are also editable by hand in account settings, so the
-- owner needs insert/update/delete of their OWN rows.
alter table public.saved_gstins enable row level security;
alter table public.saved_phones enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['saved_gstins', 'saved_phones'] loop
    execute format('drop policy if exists "own %1$s select" on public.%1$I', t);
    execute format($p$create policy "own %1$s select" on public.%1$I for select to authenticated
      using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email)$p$, t);

    execute format('drop policy if exists "own %1$s insert" on public.%1$I', t);
    execute format($p$create policy "own %1$s insert" on public.%1$I for insert to authenticated
      with check (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email)$p$, t);

    execute format('drop policy if exists "own %1$s update" on public.%1$I', t);
    execute format($p$create policy "own %1$s update" on public.%1$I for update to authenticated
      using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email)$p$, t);

    execute format('drop policy if exists "own %1$s delete" on public.%1$I', t);
    execute format($p$create policy "own %1$s delete" on public.%1$I for delete to authenticated
      using (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email)$p$, t);
  end loop;
end $$;

-- Addresses can now be added by hand from account settings too, so the owner
-- needs an insert path there as well (0076 deliberately had none).
drop policy if exists "own addresses insert" on public.saved_addresses;
create policy "own addresses insert" on public.saved_addresses
  for insert to authenticated
  with check (auth.uid() = user_id or lower(coalesce(auth.jwt() ->> 'email', '')) = email);

-- ── Backfill from what we already hold ──
-- Every GSTIN and phone ever typed at checkout, plus the profile's own, so
-- existing customers open their account settings to a populated list rather
-- than an empty one.
insert into public.saved_gstins (user_id, email, gstin, label)
select distinct on (lower(o.email), upper(o.gstin))
       o.user_id, lower(o.email), upper(o.gstin), null
from public.orders o
where o.gstin is not null and char_length(trim(o.gstin)) = 15 and o.email is not null
order by lower(o.email), upper(o.gstin), o.created_at desc
on conflict (email, gstin) do nothing;

insert into public.saved_phones (user_id, email, phone, source)
select distinct on (lower(o.email), o.phone)
       o.user_id, lower(o.email), o.phone, 'checkout'
from public.orders o
where o.phone is not null and trim(o.phone) <> '' and o.email is not null
order by lower(o.email), o.phone, o.created_at desc
on conflict (email, phone) do nothing;

-- The profile's own number, marked as the account-level one.
insert into public.saved_phones (user_id, email, phone, source)
select p.id, lower(u.email), p.phone, 'account'
from public.profiles p
join auth.users u on u.id = p.id
where p.phone is not null and trim(p.phone) <> '' and u.email is not null
on conflict (email, phone) do update set source = 'account';
