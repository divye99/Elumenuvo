-- ═══════════════════════════════════════════════════════════════
-- 0038 · Profiles: first/last name + business type
--
-- Account creation now collects first and last name separately (a single
-- "full_name" can't be used for a proper salutation or on an invoice), and
-- business accounts record what kind of business they are. `full_name` stays
-- as the composed display name so nothing that reads it breaks.
-- Idempotent; backfills first/last from any existing full_name.
-- ═══════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists first_name    text;
alter table public.profiles add column if not exists last_name     text;
alter table public.profiles add column if not exists business_type text;

comment on column public.profiles.business_type is
  'Contractor | Builder / developer | Electrical retailer | Electrician | MEP consultant | Facility management | Other';

-- Backfill: split any existing full_name into first + last (first token = first
-- name, remainder = last name). Only fills rows that don't have them yet.
update public.profiles
set first_name = split_part(trim(full_name), ' ', 1),
    last_name  = nullif(trim(substr(trim(full_name), length(split_part(trim(full_name), ' ', 1)) + 1)), '')
where full_name is not null and trim(full_name) <> '' and first_name is null;

select account_type, count(*) as profiles,
       count(first_name) as with_first_name,
       count(gstin) as with_gstin
from public.profiles group by account_type order by account_type;
