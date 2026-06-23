// Emits Supabase SQL for the catalogue from the static lib/data.ts (run via tsx).
// Usage: npx tsx scripts/gen-catalogue-sql.ts > supabase/catalogue.sql
import { PRODUCTS } from "../src/lib/data";

const q = (s: string) => `'${String(s).replace(/'/g, "''")}'`;

const header = `-- ───────────────────────────────────────────────────────────────
-- Elume catalogue → Supabase
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent upsert).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.products (
  id           text primary key,
  sku          text not null,
  name         text not null,
  brand        text not null,
  category     text not null,
  spec         text,
  mrp          numeric(12,2) not null,   -- supplier list price
  elume_price  numeric(12,2) not null,   -- our single-unit selling price
  unit         text not null default 'pc',
  image_url    text,
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Public read-only access (storefront catalogue). Writes stay server-side.
alter table public.products enable row level security;
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated using (is_active);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx    on public.products (brand);

insert into public.products (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order) values`;

const rows = PRODUCTS.map(
  (p, i) =>
    `  (${q(p.id)}, ${q(p.sku)}, ${q(p.name)}, ${q(p.brand)}, ${q(p.cat)}, ${q(p.spec)}, ${p.market}, ${p.price}, ${q(p.unit)}, ${i})`
).join(",\n");

const footer = `
on conflict (id) do update set
  sku = excluded.sku, name = excluded.name, brand = excluded.brand,
  category = excluded.category, spec = excluded.spec, mrp = excluded.mrp,
  elume_price = excluded.elume_price, unit = excluded.unit, sort_order = excluded.sort_order;
`;

process.stdout.write(`${header}\n${rows}${footer}`);
