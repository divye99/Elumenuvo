-- ═══════════════════════════════════════════════════════════════
-- 0056 · Discount codes (first use: one-time welcome offers)
--
-- Codes are validated and applied SERVER-SIDE at payment creation — the
-- client only ever sends the code string; the discounted total is computed
-- from the DB and a code is consumed only when the payment actually lands
-- (markOrderPaid). email_lock restricts a code to one customer.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.discount_codes (
  code        text primary key,                 -- stored UPPERCASE
  percent     numeric not null check (percent > 0 and percent <= 50),
  email_lock  text,                             -- only this email may use it (null = anyone)
  expires_at  timestamptz not null,
  max_uses    int not null default 1,
  used_count  int not null default 0,
  note        text,
  created_at  timestamptz not null default now()
);

alter table public.discount_codes enable row level security;
-- No public policies: service-role only. Validation happens in our API.

-- The order remembers what was applied (for invoices and analytics).
alter table public.orders add column if not exists discount_code   text;
alter table public.orders add column if not exists discount_amount numeric;
