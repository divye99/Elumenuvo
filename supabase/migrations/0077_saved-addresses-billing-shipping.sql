-- 0077: saved addresses know HOW they were used - as a billing address, a
-- shipping address, or both. Developers bill to the company office and ship
-- to sites; the checkout pickers use these flags to offer the right list in
-- the right place (billing chips vs delivery picker).

alter table public.saved_addresses add column if not exists used_billing  boolean not null default false;
alter table public.saved_addresses add column if not exists used_shipping boolean not null default false;

-- Everything saved before this migration came from the delivery address.
update public.saved_addresses set used_shipping = true where used_shipping = false and used_billing = false;
