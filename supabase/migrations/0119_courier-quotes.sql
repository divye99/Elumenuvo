-- 0119: courier quote tracking - the dataset behind rate intelligence.
--
-- EVERY rate check in the admin ship panel logs EVERY courier option shown
-- (not just the one picked): lane (pickup/delivery pin + state), weights
-- (dead / volumetric / chargeable), price, promised pickup + delivery dates,
-- and the courier's ratings at that moment. Booking marks the chosen row.
--
-- This is deliberately raw and complete: per-lane/per-weight-band analysis
-- (who is cheapest to Kerala under 2 kg?), promised-vs-actual scoring once
-- delivery telemetry lands in order_shipments, and eventually a learned
-- recommendation all read from here. The model can only ever be as good as
-- this log - so log everything.

create table if not exists public.courier_quotes (
  id bigint generated always as identity primary key,
  order_id text not null,
  pickup_location text,
  pickup_pin text,
  delivery_pin text,
  delivery_state text,
  dead_weight_kg numeric,
  vol_weight_kg numeric,
  charge_weight_kg numeric,
  courier_id integer,
  courier_name text,
  mode text,
  rate numeric,
  etd date,
  est_days integer,
  pickup_date date,
  rating numeric,
  pickup_rating numeric,
  delivery_rating numeric,
  chosen boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists courier_quotes_order_idx on public.courier_quotes (order_id);
create index if not exists courier_quotes_lane_idx on public.courier_quotes (courier_name, delivery_state);

alter table public.courier_quotes enable row level security;
-- No policies on purpose: service-role only.
