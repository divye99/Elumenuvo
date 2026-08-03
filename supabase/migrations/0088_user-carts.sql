-- 0088: the cart follows the account, not the browser.
--
-- Until now the cart lived only in localStorage, so it was lost whenever a
-- shopper cleared browsing data or moved to another device: signing in on a
-- phone showed an empty cart even though the desktop cart was full. One row
-- per user holds the whole cart as jsonb; the client keeps localStorage as the
-- fast local copy and reconciles against this on sign-in.
--
-- Guests are deliberately not stored: there is no stable identity to key on,
-- and localStorage already covers the same-browser case.

create table if not exists public.user_carts (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_carts_updated_idx on public.user_carts (updated_at desc);

alter table public.user_carts enable row level security;

-- Strictly owner-scoped: a cart is only ever readable and writable by the
-- account it belongs to.
drop policy if exists "own cart select" on public.user_carts;
create policy "own cart select" on public.user_carts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own cart upsert" on public.user_carts;
create policy "own cart upsert" on public.user_carts
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own cart update" on public.user_carts;
create policy "own cart update" on public.user_carts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cart delete" on public.user_carts;
create policy "own cart delete" on public.user_carts
  for delete to authenticated using (auth.uid() = user_id);
