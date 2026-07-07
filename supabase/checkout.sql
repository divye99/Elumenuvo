-- ═══════════════════════════════════════════════════════════════
-- Checkout — extend the orders table with the fields a storefront/guest order
-- needs. Run AFTER verified-reviews.sql (which creates public.orders).
-- Idempotent. Orders are written server-side (service role) only.
-- ═══════════════════════════════════════════════════════════════

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
