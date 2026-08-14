-- 0111: sequential tax-invoice numbers, FY-wise (accounting requirement).
--
-- A GST tax invoice must carry a consecutive serial number unique to the
-- financial year (CGST Rule 46(b)). The admin invoice button assigns one the
-- FIRST time a tax invoice is generated for an order and reuses it forever
-- after - regenerating the PDF never consumes a fresh number.
--
-- Format: EN/<fy>/<0001>  e.g. EN/2026-27/0001   (EN = Elume Nuvotech)
-- Proforma invoices are numbered PI/<order-id> and never touch this counter.

alter table public.orders add column if not exists invoice_no text;
alter table public.orders add column if not exists invoice_date timestamptz;

create table if not exists public.invoice_counters (
  fy text primary key,
  next_no integer not null default 1
);

-- Atomic assign: row-locks the counter so two admins clicking at once can
-- never mint the same serial. Idempotent: an order that already has a number
-- gets it back unchanged.
create or replace function public.assign_invoice_no(p_order_id text, p_fy text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no text;
  v_n integer;
begin
  select invoice_no into v_no from orders where id = p_order_id for update;
  if v_no is not null then
    return v_no;
  end if;
  insert into invoice_counters (fy, next_no) values (p_fy, 1)
    on conflict (fy) do nothing;
  update invoice_counters set next_no = next_no + 1
    where fy = p_fy
    returning next_no - 1 into v_n;
  v_no := 'EN/' || p_fy || '/' || lpad(v_n::text, 4, '0');
  update orders set invoice_no = v_no, invoice_date = now() where id = p_order_id;
  return v_no;
end;
$$;

revoke all on function public.assign_invoice_no(text, text) from public, anon, authenticated;
