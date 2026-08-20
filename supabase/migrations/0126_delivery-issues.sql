-- ═══════════════════════════════════════════════════════════════
-- 0126 · Delivery issues: failed deliveries, RTO, redelivery workflow
--
-- Owner ask (Aug 2026, the Ruhi Enterprises RTO): when a parcel fails to
-- deliver (courier's fault, buyer's fault, any reason), the orders page must
-- carry the WHOLE journey: record the failure with its exact reason and
-- whose fault it was, let the CUSTOMER decide on the platform what happens
-- next (redeliver same address / corrected address / cancel) via a tokened
-- link, price the redelivery (a fee, or explicitly free "on us"), and feed
-- the courier scorecard with fault-classified reasons so buyer faults never
-- count against a delivery partner.
--
-- One row = one delivery incident on one order (optionally one shipment).
-- Service-role only; the public decision page resolves by decision_token.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.delivery_issues (
  id              uuid primary key default gen_random_uuid(),
  order_id        text not null references public.orders (id) on delete cascade,
  shipment_id     uuid references public.order_shipments (id) on delete set null,
  kind            text not null check (kind in
                    ('undelivered', 'rto', 'address_issue', 'refused', 'not_reachable', 'damaged', 'lost', 'other')),
  -- Whose fault: drives the courier scorecard. Buyer faults NEVER count
  -- against the courier.
  fault           text not null default 'unknown' check (fault in ('buyer', 'courier', 'ops', 'unknown')),
  reason          text not null,                    -- the exact reason, in words
  courier         text,                             -- snapshot for the scorecard
  awb             text,
  -- Redelivery pricing: 0 = free. fee_note carries the framing shown to the
  -- customer ("On us - our unmatchable customer service" or "collected with
  -- the redelivered parcel").
  redelivery_fee  numeric not null default 0,
  fee_note        text,
  status          text not null default 'open' check (status in
                    ('open', 'awaiting_customer', 'customer_decided', 'redelivery_booked', 'resolved', 'cancelled')),
  decision_token  text unique,                      -- the customer's decision link
  customer_choice text check (customer_choice in ('redeliver', 'redeliver_new_address', 'cancel_order')),
  customer_note   text,
  new_address     text,                             -- corrected address, plain text
  decided_at      timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists delivery_issues_order_idx   on public.delivery_issues (order_id, created_at desc);
create index if not exists delivery_issues_token_idx   on public.delivery_issues (decision_token);
create index if not exists delivery_issues_courier_idx on public.delivery_issues (courier);

alter table public.delivery_issues enable row level security; -- service-role only

select 'delivery issues workflow ready' as status;
