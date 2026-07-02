-- ───────────────────────────────────────────────────────────────
-- Elume: reviews + credit waitlist + product variants & sort signals
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
-- ───────────────────────────────────────────────────────────────

-- ── 1. Product columns: sort signals + variant grouping ──
alter table public.products add column if not exists units_sold     int     not null default 0;
alter table public.products add column if not exists is_recommended boolean not null default false;
alter table public.products add column if not exists variant_group  text;
alter table public.products add column if not exists attrs          jsonb;

-- ── 2. Reviews ──
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  rating      int  not null check (rating between 1 and 5),
  title       text check (char_length(title) <= 120),
  body        text check (char_length(body) <= 4000),
  is_approved boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);

alter table public.reviews enable row level security;
drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews
  for select using (is_approved);
drop policy if exists "public write reviews" on public.reviews;
create policy "public write reviews" on public.reviews
  for insert to anon, authenticated with check (rating between 1 and 5);

-- ── 3. Credit waitlist (NBFC credit — developing feature) ──
create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (position('@' in email) > 1),
  name       text,
  company    text,
  feature    text not null default 'nbfc-credit',
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;
drop policy if exists "public join waitlist" on public.waitlist;
create policy "public join waitlist" on public.waitlist
  for insert to anon, authenticated with check (true);
-- no select policy: signups are write-only for the public.

-- ── 4. Backfill variant groups (siblings shown as Size/Colour/Length/Quality options) ──
-- CMI GreenShield house wires: Size × Colour
update public.products set variant_group = 'cmi-greenshield',
  attrs = jsonb_build_object(
    'Size',    case when id like '%-10-%' then '1.0 sq mm' when id like '%-15-%' then '1.5 sq mm' else '2.5 sq mm' end,
    'Colour',  case when id like '%-red' then 'Red' when id like '%-blu' then 'Blue' when id like '%-blk' then 'Black' when id like '%-yel' then 'Yellow' else 'Green' end,
    'Length',  '90 m',
    'Quality', 'FR'
  )
where id like 'cmi-gs-%';

-- Polycab single-core wires: Size (quality FRLS/FR per row)
update public.products set variant_group = 'polycab-housewire',
  attrs = jsonb_build_object(
    'Size', case id when 'poly15' then '1.5 sq mm' when 'poly25' then '2.5 sq mm' else '6.0 sq mm' end,
    'Length', '90 m',
    'Quality', case id when 'poly-fr-60' then 'FR' else 'FRLS' end
  )
where id in ('poly15', 'poly25', 'poly-fr-60');

-- Finolex FR wires: Size
update public.products set variant_group = 'finolex-fr',
  attrs = jsonb_build_object(
    'Size', case id when 'fin-fr-10' then '1.0 sq mm' else '4.0 sq mm' end,
    'Length', '90 m', 'Quality', 'FR'
  )
where id in ('finfr4', 'fin-fr-10');

-- KEI Conflame: Size
update public.products set variant_group = 'kei-conflame',
  attrs = jsonb_build_object(
    'Size', case id when 'kei-fr-15' then '1.5 sq mm' else '2.5 sq mm' end,
    'Length', '90 m', 'Quality', 'FR'
  )
where id in ('kei-fr-15', 'kei-fr-25');

-- RR Kabel Superex: Size
update public.products set variant_group = 'rr-superex',
  attrs = jsonb_build_object(
    'Size', case id when 'rr-fr-15' then '1.5 sq mm' else '2.5 sq mm' end,
    'Length', '90 m', 'Quality', 'FR'
  )
where id in ('rr-fr-15', 'rr-fr-25');

-- Havells Life Line: Size
update public.products set variant_group = 'havells-lifeline',
  attrs = jsonb_build_object(
    'Size', case id when 'hav-ll-15' then '1.5 sq mm' else '2.5 sq mm' end,
    'Length', '90 m', 'Quality', 'FR'
  )
where id in ('hav-ll-15', 'hav-ll-25');

-- ── 5. Merchant-curated "Recommended" picks (editable any time) ──
update public.products set is_recommended = true
where id in ('cmi-gs-15-red', 'poly25', 'hav32', 'atm-ren-1200', 'anc-roma-16sw', 'sys-bat-20', 'hav-db-8spn', 'leg-myr-6s');

select 'products' as t, count(*) from public.products
union all select 'with variants', count(*) from public.products where variant_group is not null
union all select 'recommended', count(*) from public.products where is_recommended;
