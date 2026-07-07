-- ═══════════════════════════════════════════════════════════════
-- Checkout — the orders table + all fields a storefront/guest order needs.
-- Self-contained & idempotent: creates public.orders if it doesn't already
-- exist (verified-reviews.sql creates the same base table), then adds the
-- storefront columns. Orders are written server-side (service role) only.
-- ═══════════════════════════════════════════════════════════════

-- Base table (matches verified-reviews.sql so either can run first).
create table if not exists public.orders (
  id          text primary key,                 -- e.g. ELM-2607-0001
  email       text not null,
  product_ids text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.orders enable row level security;
-- No anon policies: written server-side (service role) only, never public-read.

-- Storefront / guest-checkout columns.
alter table public.orders add column if not exists name             text;
alter table public.orders add column if not exists phone            text;
alter table public.orders add column if not exists gstin            text;
alter table public.orders add column if not exists billing_address  text;
alter table public.orders add column if not exists shipping_address text;
alter table public.orders add column if not exists payment_method   text;
alter table public.orders add column if not exists items            jsonb;   -- [{id,name,qty,price}]
alter table public.orders add column if not exists subtotal         numeric;
alter table public.orders add column if not exists total            numeric;
alter table public.orders add column if not exists is_guest         boolean not null default true;
alter table public.orders add column if not exists user_id          uuid;
alter table public.orders add column if not exists status           text not null default 'placed';

select 'orders columns ready' as status;
