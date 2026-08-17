-- 0118: marking an ORDER delivered rolls its parcels to delivered too.
--
-- The parcel-level "Mark delivered" button already rolls UP to the order
-- (all parcels delivered -> order delivered). This adds the missing DOWN
-- direction: the order-level "Mark delivered" button (and any future path -
-- courier sync, support tooling) flips every open shipment of that order to
-- delivered, so the Shipments card never contradicts the order status.
--
-- Done as a trigger, not app code, so EVERY writer gets the behaviour.

create or replace function public.sync_shipments_on_delivered()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    update public.order_shipments
    set status = 'delivered',
        delivered_at = coalesce(delivered_at, new.delivered_at, now())
    where order_id = new.id and status <> 'delivered';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_delivered_rollup on public.orders;
create trigger orders_delivered_rollup
after update of status on public.orders
for each row execute function public.sync_shipments_on_delivered();

-- Backfill: parcels of orders that were already marked delivered before this
-- trigger existed.
update public.order_shipments s
set status = 'delivered',
    delivered_at = coalesce(s.delivered_at, o.delivered_at, now())
from public.orders o
where o.id = s.order_id and o.status = 'delivered' and s.status <> 'delivered';
