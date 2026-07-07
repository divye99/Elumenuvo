-- ═══════════════════════════════════════════════════════════════
-- Online payment (Razorpay) — store the payment references on paid orders.
-- Run AFTER 0009_checkout.sql. Idempotent. Paid orders are inserted only after
-- the payment signature is verified server-side.
-- ═══════════════════════════════════════════════════════════════

alter table public.orders add column if not exists razorpay_order_id   text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists paid_at             timestamptz;

select 'online-payment columns ready' as status;
