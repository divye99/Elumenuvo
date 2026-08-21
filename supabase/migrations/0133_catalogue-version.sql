-- 0133: catalogue watermark (owner, 21 Aug 2026).
-- The storefront caches the catalogue for hours to keep Vercel cache writes
-- cheap. Console edits already drop that cache instantly, but changes made
-- by scripts or raw SQL had no way to announce themselves. This table holds
-- one row whose version is bumped by statement-level triggers on every
-- insert/update/delete of products or reviews, however it was made. The app
-- reads it at most once a minute per instance and keys its cache entries by
-- it, so any change reaches the site within about a minute, automatically,
-- and new cache entries are written only when something actually changed.
-- Idempotent; safe to re-run.

create table if not exists public.catalogue_version (
  singleton  boolean primary key default true check (singleton),
  version    bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  updated_at timestamptz not null default now()
);

insert into public.catalogue_version (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.catalogue_version enable row level security;
drop policy if exists "read catalogue version" on public.catalogue_version;
create policy "read catalogue version" on public.catalogue_version
  for select to anon, authenticated using (true);

create or replace function public.bump_catalogue_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.catalogue_version
     set version = (extract(epoch from clock_timestamp()) * 1000)::bigint,
         updated_at = now()
   where singleton;
  return null;
end $$;

drop trigger if exists products_bump_catalogue_version on public.products;
create trigger products_bump_catalogue_version
  after insert or update or delete on public.products
  for each statement execute function public.bump_catalogue_version();

drop trigger if exists reviews_bump_catalogue_version on public.reviews;
create trigger reviews_bump_catalogue_version
  after insert or update or delete on public.reviews
  for each statement execute function public.bump_catalogue_version();
