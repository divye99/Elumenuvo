-- ═══════════════════════════════════════════════════════════════
-- Verified-purchaser reviews — run AFTER catalogue-v2.sql.
-- Idempotent: safe to re-run.
--
-- Model: an `orders` row (order id + buyer email + product ids) is the
-- proof of purchase. Review inserts are verified IN THE DATABASE by a
-- security-definer function the RLS policy calls — nobody can post a
-- review without a matching order, no matter what the client sends.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Orders (proof-of-purchase ledger; write via service role/admin) ──
create table if not exists public.orders (
  id          text primary key,                 -- e.g. ELM-2607-0001
  email       text not null,
  product_ids text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.orders enable row level security;
-- No anon policies: orders are written server-side (service role) only and
-- are never publicly readable.

-- ── 2. Review columns for verification ──
alter table public.reviews add column if not exists order_id       text;
alter table public.reviews add column if not exists reviewer_email text;
alter table public.reviews add column if not exists is_verified    boolean not null default true;

-- ── 3. DB-enforced purchase verification ──
create or replace function public.is_verified_purchase(p_order_id text, p_email text, p_product_id text)
returns boolean
language sql
security definer                -- runs as owner → can read orders past RLS
set search_path = public
as $$
  select exists (
    select 1 from public.orders o
    where o.id = upper(trim(p_order_id))
      and lower(o.email) = lower(trim(p_email))
      and p_product_id = any(o.product_ids)
  );
$$;
revoke all on function public.is_verified_purchase(text, text, text) from public;
grant execute on function public.is_verified_purchase(text, text, text) to anon, authenticated;

drop policy if exists "public write reviews" on public.reviews;
create policy "verified purchasers write reviews" on public.reviews
  for insert to anon, authenticated
  with check (
    rating between 1 and 5
    and public.is_verified_purchase(order_id, reviewer_email, product_id)
  );

-- ── 4. Column privacy: never expose reviewer emails / order ids ──
revoke select on public.reviews from anon, authenticated;
grant select (id, product_id, author_name, rating, title, body, is_verified, created_at)
  on public.reviews to anon, authenticated;
grant insert on public.reviews to anon, authenticated;

-- ── 5. Founder test order (lets you exercise the flow end-to-end) ──
insert into public.orders (id, email, product_ids) values
  ('ELM-TEST-0001', 'divye2014@gmail.com',
   array['cmi-gs-15-red','poly25','hav32','atm-ren-1200'])
on conflict (id) do nothing;

select 'orders' as t, count(*)::text as n from public.orders
union all select 'reviews', count(*)::text from public.reviews;
