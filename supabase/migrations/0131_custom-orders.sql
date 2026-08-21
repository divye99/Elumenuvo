-- 0131: custom orders (owner ask, Aug 2026). The admin prepares an order for
-- specific/customised products at an admin-set price; the customer opens a
-- link, completes the normal checkout (details + Razorpay) and the result is
-- an ordinary row in public.orders. Offline-paid orders skip the link and are
-- inserted directly with order_kind 'custom'.

create table if not exists public.custom_orders (
  token              text primary key,                      -- url-safe, in the link
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '14 days',
  status             text not null default 'open' check (status in ('open', 'converted', 'cancelled', 'expired')),
  customer           jsonb not null default '{}'::jsonb,    -- prefill: name, email, phone, gstin, billing, shipping
  items              jsonb not null,                        -- checkout item shape; price is GST-inclusive; custom lines carry custom=true
  shipping_fee       numeric,                               -- null = standard tiered delivery
  discount_amount    numeric not null default 0,
  note               text,                                  -- customer-facing message on the link page
  admin_note         text,
  source             text,                                  -- phone / whatsapp / email / walk-in / quotation
  converted_order_id text references public.orders(id),
  converted_at       timestamptz,
  created_by         text
);
create index if not exists custom_orders_status_idx on public.custom_orders (status, created_at desc);
alter table public.custom_orders enable row level security;
-- No public policies: read and written server-side (service role) only.

-- Link a converted order back to the custom order it came from.
alter table public.orders add column if not exists custom_token text;
