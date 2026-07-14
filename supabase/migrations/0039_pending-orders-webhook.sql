-- ═══════════════════════════════════════════════════════════════
-- 0039 · Pending orders + Razorpay webhook support
--
-- Online orders are now written as `awaiting_payment` BEFORE the payment window
-- opens, then flipped to `placed` by whichever lands first: the browser callback
-- or the Razorpay webhook. Previously the row was only written on the browser
-- callback, so a customer who paid and then closed the tab / lost signal /
-- app-switched mid-UPI was charged with no order to show for it.
--
-- Order statuses now in use:
--   awaiting_payment  → Razorpay order created, money not captured yet
--   placed            → paid and confirmed (emails sent, exactly once)
--   payment_abandoned → never paid; expired by the sweeper cron
--   (+ the existing fulfilment statuses)
--
-- Idempotency is enforced in code by a conditional update on
-- status = 'awaiting_payment', so the callback and the webhook can race safely.
-- Idempotent migration.
-- ═══════════════════════════════════════════════════════════════

-- The webhook looks an order up by its Razorpay order id.
create index if not exists orders_razorpay_order_id_idx on public.orders (razorpay_order_id);

-- The sweeper and the admin list filter on status.
create index if not exists orders_status_idx on public.orders (status);

comment on column public.orders.status is
  'awaiting_payment | placed | payment_abandoned | packed | shipped | delivered | cancelled';

-- Any orders that predate this change are paid-and-placed by definition.
update public.orders set status = 'placed'
where status is null or trim(status) = '';

select status, count(*) from public.orders group by status order by status;
