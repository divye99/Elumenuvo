-- 0090: Metals go live - booking columns, launch rates, RTGS bank block.
-- Run AFTER 0087 (tables + seeds) and AFTER the deploy that ships the
-- metals booking flow (this migration ACTIVATES the rods on the storefront).

-- ── 1. Booking model on orders ──────────────────────────────────────────────
-- A metals booking collects a 5% token online (Razorpay) and the balance by
-- RTGS. orders.total stays the FULL order value (invoicing/reporting truth);
-- token_amount is what Razorpay actually captured, balance_due the RTGS part.
alter table public.orders add column if not exists order_kind text not null default 'standard';
alter table public.orders add column if not exists token_amount numeric(12,2);
alter table public.orders add column if not exists balance_due numeric(12,2);
alter table public.orders add column if not exists balance_received_at timestamptz;

-- ── 2. Launch rates (set 2026-08-03 by the business) ────────────────────────
-- CCR Rod: ₹1365/kg ex-GST → ₹1610.70/kg incl 18% → 3 MT 48,32,100 · 4 MT 64,42,800
-- CC Rod:  ₹1400/kg ex-GST → ₹1652.00/kg incl 18% → 3 MT 49,56,000 · 4 MT 66,08,000
-- Idempotent updates (0087 seeded placeholders); Super D stays hidden until
-- its specs arrive.
update public.products set elume_price = 4832100, mrp = 4832100, is_active = true where id = 'copper-ccr-rod-3mt';
update public.products set elume_price = 6442800, mrp = 6442800, is_active = true where id = 'copper-ccr-rod-4mt';
update public.products set elume_price = 4956000, mrp = 4956000, is_active = true where id = 'copper-cc-rod-3mt';
update public.products set elume_price = 6608000, mrp = 6608000, is_active = true where id = 'copper-cc-rod-4mt';

-- First rate snapshot so the selling-rate chart starts at launch day.
insert into public.price_history (product_id, elume_price, mrp)
select id, elume_price, mrp from public.products
where id in ('copper-ccr-rod-3mt','copper-ccr-rod-4mt','copper-cc-rod-3mt','copper-cc-rod-4mt')
  and not exists (select 1 from public.price_history ph where ph.product_id = public.products.id);

-- ── 3. RTGS bank details content block ──────────────────────────────────────
-- Edited in /admin/content (key: metals_bank). Until filled, booking emails
-- and the confirmation page show a "details follow by email" fallback.
insert into public.content (key, data)
values ('metals_bank', '{"account_name":"","account_number":"","ifsc":"","bank":"","branch":"","note":"Quote your order id as the RTGS remark."}'::jsonb)
on conflict (key) do nothing;
