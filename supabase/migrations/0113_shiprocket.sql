-- 0113: Shiprocket integration - shipment telemetry + a tiny server KV store.
--
-- order_shipments grows the columns the courier pipeline writes:
--   sr_order_id / sr_shipment_id  Shiprocket's ids for the booking
--   courier_id                    Shiprocket courier_company_id (scorecard joins)
--   freight_charge                what Shiprocket quoted US at booking (Rs)
--   entered_weight_kg / dims_cm   what admin typed at packing (actuals)
--   billed_weight_kg              what the courier billed (weight-audit view)
--   etd / promised_days           the courier's promise at booking
--   manifest_at / picked_up_at    handover milestones (time-loss funnel)
--   sr_status / sr_events         latest tracking status + full scan history
--   label_url / pickup_location   label PDF + which warehouse it left from
--
-- app_kv: one-row-per-key JSON store, used for the Shiprocket auth token
-- (valid 10 days; serverless functions share it instead of re-logging-in).

alter table public.order_shipments add column if not exists sr_order_id bigint;
alter table public.order_shipments add column if not exists sr_shipment_id bigint;
alter table public.order_shipments add column if not exists courier_id integer;
alter table public.order_shipments add column if not exists freight_charge numeric;
alter table public.order_shipments add column if not exists entered_weight_kg numeric;
alter table public.order_shipments add column if not exists billed_weight_kg numeric;
alter table public.order_shipments add column if not exists dims_cm text;
alter table public.order_shipments add column if not exists etd timestamptz;
alter table public.order_shipments add column if not exists promised_days integer;
alter table public.order_shipments add column if not exists manifest_at timestamptz;
alter table public.order_shipments add column if not exists picked_up_at timestamptz;
alter table public.order_shipments add column if not exists sr_status text;
alter table public.order_shipments add column if not exists sr_events jsonb;
alter table public.order_shipments add column if not exists label_url text;
alter table public.order_shipments add column if not exists pickup_location text;

create index if not exists order_shipments_awb_idx on public.order_shipments (awb);

create table if not exists public.app_kv (
  k text primary key,
  v jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_kv enable row level security;
-- No policies on purpose: only the service role (which bypasses RLS) may
-- read or write - the anon key gets nothing.
