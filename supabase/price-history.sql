-- ═══════════════════════════════════════════════════════════════
-- Elume price history — a snapshot of every product's price over time so the
-- product page can show a price-history chart for ALL products (mapped or not).
-- Run once in Supabase → SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.price_history (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products(id) on delete cascade,
  elume_price numeric not null,
  mrp         numeric,
  captured_at timestamptz not null default now()
);
create index if not exists price_history_idx on public.price_history (product_id, captured_at);

alter table public.price_history enable row level security;
-- Public read (prices only — the product page reads this via the anon key).
drop policy if exists "public read price history" on public.price_history;
create policy "public read price history" on public.price_history for select using (true);

-- Seed a first snapshot for every product that doesn't have one yet, so every
-- product shows at least its current price today (history grows from here).
insert into public.price_history (product_id, elume_price, mrp)
select p.id, p.elume_price, p.mrp
from public.products p
where not exists (select 1 from public.price_history h where h.product_id = p.id);
