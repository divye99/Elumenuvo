-- 0092: shipping becomes a real, recorded charge.
--
-- Tiers (on the GST-inclusive goods total, after any discount code):
--   under 2,000            -> 200
--   2,000 to under 4,000   -> 100
--   4,000 and above        -> free
--
-- The fee is stored on its own column rather than folded into an item line so
-- that every consumer of the order row can keep its arithmetic honest:
-- subtotal (ex-GST goods) + GST = goods total, and goods total + shipping_fee
-- = total charged. Existing rows predate the fee and genuinely shipped free,
-- so the default 0 is historically accurate, not a fudge.

alter table public.orders
  add column if not exists shipping_fee numeric not null default 0;

comment on column public.orders.shipping_fee is
  'Flat delivery charge included in `total`. 0 = free (orders >= 4000, and all orders before Aug 2026). Goods GST math excludes it.';
