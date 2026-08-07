-- ═══════════════════════════════════════════════════════════════
-- 0095: "Compare with other items" - like-to-like product mapping.
-- Idempotent: safe to re-run.
--
-- products.compare_key  - canonical key-spec fingerprint (e.g.
--                         'wires|1.5|90|frls|1c'). Products sharing a key
--                         form a compare group. null = never mapped.
-- products.compare_meta - jsonb {conflicts, display, source} produced by
--                         src/lib/compare/fingerprint.ts. conflicts are
--                         softer specs that must not contradict between two
--                         paired products; display is the 5-spec table the
--                         PDP shows; source marks attrs-based vs
--                         text-extracted rows for admin spot-checking.
-- compare_rejections    - admin "never pair these two" decisions. Permanent:
--                         they survive every rebuild. Stored with a < b so
--                         one row covers both directions.
--
-- Keys are (re)computed by /api/cron/rebuild-compare nightly and by the
-- "Rebuild mappings" button in /admin/compare, so a newly imported brand
-- maps into existing groups automatically.
-- ═══════════════════════════════════════════════════════════════

alter table public.products add column if not exists compare_key  text;
alter table public.products add column if not exists compare_meta jsonb;
create index if not exists products_compare_key_idx
  on public.products (compare_key) where compare_key is not null;

create table if not exists public.compare_rejections (
  a          text not null references public.products(id) on delete cascade,
  b          text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);
alter table public.compare_rejections enable row level security;
-- Pairs of public product ids only - safe to read, written via service role.
drop policy if exists "public read compare rejections" on public.compare_rejections;
create policy "public read compare rejections" on public.compare_rejections
  for select to anon, authenticated using (true);
