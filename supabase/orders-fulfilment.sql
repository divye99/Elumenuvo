-- ═══════════════════════════════════════════════════════════════
-- Order fulfilment — status workflow, partial shipments, event timeline and a
-- delivery-proof storage bucket. Run AFTER checkout.sql (which creates orders).
-- Idempotent. All writes are server-side (admin service role); the customer
-- tracking page looks up by order id + email server-side (email = shared secret).
--
-- Order status values: placed · confirmed · packed · shipped ·
--                      partially_shipped · out_for_delivery · delivered · cancelled
-- ═══════════════════════════════════════════════════════════════

-- Fulfilment columns on orders.
alter table public.orders add column if not exists admin_note   text;
alter table public.orders add column if not exists confirmed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists updated_at   timestamptz not null default now();

-- Partial shipments — one order can ship in several parcels.
create table if not exists public.order_shipments (
  id           uuid primary key default gen_random_uuid(),
  order_id     text not null references public.orders(id) on delete cascade,
  courier      text,
  awb          text,                              -- tracking / airway-bill number
  tracking_url text,
  items        jsonb not null default '[]',       -- [{id,name,qty}] subset in this parcel
  status       text not null default 'packed',    -- packed | shipped | out_for_delivery | delivered
  proof_url    text,                              -- delivery-proof image (Storage)
  shipped_at   timestamptz,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists order_shipments_order_idx on public.order_shipments (order_id);

-- Event timeline (status history + notes) — powers the admin detail timeline
-- and the customer tracking page.
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   text not null references public.orders(id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id, created_at);

alter table public.order_shipments enable row level security;
alter table public.order_events   enable row level security;
-- No public policies: written via service role; customer tracking reads
-- server-side after matching order id + email.

-- Public-read bucket for delivery-proof photos.
insert into storage.buckets (id, name, public) values ('delivery-proofs', 'delivery-proofs', true)
on conflict (id) do nothing;

-- Backfill a 'placed' event for any existing order without one.
insert into public.order_events (order_id, status, note)
select id, coalesce(status, 'placed'), 'Order placed'
from public.orders o
where not exists (select 1 from public.order_events e where e.order_id = o.id);

select 'fulfilment ready' as status,
       (select count(*) from public.orders) as orders,
       (select count(*) from public.order_events) as events;
